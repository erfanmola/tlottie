import { defaultWorkerPool, type TLottieWorkerPool } from "../worker/pool.ts";
import type {
	MainToWorkerMessage,
	WorkerToMainMessage,
} from "../worker/protocol.ts";
import { resolveWasmUrl } from "./wasm-url.ts";

export interface InitializeTLottieOptions {
	/** Resize and warm the selected shared pool. Each player still uses one worker. */
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
 * times or with different pools. Handle rejection if initialization fails.
 */
export async function initializeTLottie(
	options: InitializeTLottieOptions = {},
): Promise<void> {
	const pool = options.pool ?? defaultWorkerPool;
	if (options.workerCount !== undefined) pool.setSize(options.workerCount);
	const wasmUrl = resolveWasmUrl(options.wasmUrl);
	const workers = pool.getAllWorkers();

	return Promise.all(
		workers.map(
			(worker) =>
				new Promise<void>((resolve, reject) => {
					const requestId = generateRequestId();
					const cleanup = () => {
						worker.removeEventListener("message", onMessage);
						worker.removeEventListener("error", onError);
					};
					const onError = (event: ErrorEvent) => {
						cleanup();
						reject(
							new Error(
								event.message ||
									"tlottie: render worker failed to load; check its URL and Vite optimizeDeps.exclude",
							),
						);
					};
					const onMessage = (ev: MessageEvent<WorkerToMainMessage>): void => {
						const data = ev.data;
						if (data.type !== "warmed" && data.type !== "warmup-error") return;
						if (data.requestId !== requestId) return;
						cleanup();
						if (data.type === "warmed") resolve();
						else reject(new Error(data.message));
					};
					worker.addEventListener("message", onMessage);
					worker.addEventListener("error", onError);
					try {
						worker.postMessage({
							type: "warmup",
							requestId,
							wasmUrl,
						} satisfies MainToWorkerMessage);
					} catch (error) {
						cleanup();
						reject(error);
					}
				}),
		),
	).then(() => undefined);
}
