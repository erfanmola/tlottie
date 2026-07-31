import { defaultWorkerPool, TLottieWorkerPool } from "../worker/pool.ts";
import type {
	MainToWorkerMessage,
	WorkerToMainMessage,
} from "../worker/protocol.ts";
import { DEFAULT_WASM_URL } from "./wasm-url.ts";

export interface InitializeTLottieOptions {
	/** Warm up a dedicated pool of this size instead of the shared default pool. */
	workerCount?: number;
	/** Advanced: warm up a specific pool instance (e.g. one you're about to pass as `pool` to several players). */
	pool?: TLottieWorkerPool;
	wasmUrl?: string | URL;
}

let idCounter = 0;
function generateRequestId(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
		return crypto.randomUUID();
	idCounter += 1;
	return `tlottie-warmup-${Date.now()}-${idCounter}`;
}

/**
 * Without calling this, the render worker(s) and the wasm module are both
 * created lazily — the first `Worker` spins up when the first `TLottie`
 * instance mounts (deferred one frame), and the wasm binary isn't fetched
 * until that instance's animation source has resolved. That's fine for a
 * single player appearing immediately, but means the wasm download doesn't
 * even start until fairly late in a page's lifecycle.
 *
 * Call this as early as you like (module load, route change, hover intent,
 * etc.) to kick off worker creation and the wasm fetch/instantiate ahead of
 * time — by the time a real `TLottie`/`LottiePlayer` mounts, its worker is
 * already warm. Every worker in the (grown-to-full-size) pool is warmed,
 * since each one owns its own wasm module instance. Safe to call multiple
 * times or with different pools; safe to ignore the returned promise.
 */
export function initializeTLottie(
	options: InitializeTLottieOptions = {},
): Promise<void> {
	const pool =
		options.pool ??
		(options.workerCount !== undefined
			? new TLottieWorkerPool(options.workerCount)
			: defaultWorkerPool);
	const wasmUrl = (options.wasmUrl ?? DEFAULT_WASM_URL).toString();
	const workers = pool.getAllWorkers();

	return Promise.all(
		workers.map(
			(worker) =>
				new Promise<void>((resolve, reject) => {
					const requestId = generateRequestId();
					const onMessage = (ev: MessageEvent<WorkerToMainMessage>): void => {
						const data = ev.data;
						if (data.type !== "warmed" && data.type !== "warmup-error") return;
						if (data.requestId !== requestId) return;
						worker.removeEventListener("message", onMessage);
						if (data.type === "warmed") resolve();
						else reject(new Error(data.message));
					};
					worker.addEventListener("message", onMessage);
					worker.postMessage({
						type: "warmup",
						requestId,
						wasmUrl,
					} satisfies MainToWorkerMessage);
				}),
		),
	).then(() => undefined);
}
