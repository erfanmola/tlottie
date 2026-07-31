/// <reference lib="webworker" />
import { decodeAnimationBytes } from "../core/gzip.ts";
import { TLottieInstance } from "../core/instance.ts";
import { PlayerEngine } from "../core/player-engine.ts";
import { DEFAULT_RENDER_QUALITY, type RenderQuality } from "../core/types.ts";
import { loadWasmModule, type TLottieWasmExports } from "../core/wasm.ts";
import type {
	MainToWorkerMessage,
	WorkerInitConfig,
	WorkerToMainMessage,
} from "./protocol.ts";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

// `new URL('literal', import.meta.url)` (no `@vite-ignore`, no `?url`
// import specifier) is Vite's own static-asset pattern — the same one Vite
// emits internally for `new Worker(new URL('./x.ts', import.meta.url))`,
// which is why that pattern already survives being re-bundled by a
// consuming app's own Vite build. Vite resolves the literal against this
// file's real position on disk at every build (`src/worker/` ->
// `../core/tlottie.wasm` exists there in source, in dist, in a consumer's
// node_modules — same relative layout every time) and rewrites it to the
// wasm file's actual emitted/hashed URL, so a downstream bundler that
// re-processes this file sees the same recognizable pattern and copies the
// asset again itself. A hand-computed relative path counting "how many
// directories up does the wasm file sit from this worker chunk" looks
// similar but is invisible to static analysis — a consumer's bundler has
// no way to know it needs to copy tlottie.wasm at all.
//
// The `?no-inline` query is also load-bearing: every one of this package's
// 7 build targets is a library build (`build.lib` in each
// vite.*.config.ts), and Vite/Rolldown unconditionally base64-inlines any
// asset referenced from a library build regardless of `assetsInlineLimit`
// — without it, this ~418KB wasm binary gets inlined straight into the
// worker chunk as a data URI on every build, ballooning it from ~10KB to
// ~560KB and defeating the whole point of fetching+caching it once (see
// README's "not bundled per adapter" note). `?no-inline` opts this
// specific reference out of that.
export const WORKER_DEFAULT_WASM_URL: URL = new URL(
	"../core/tlottie.wasm?no-inline",
	import.meta.url,
);

// One compiled wasm module per worker, reused for every animation routed to
// it — re-instantiating wasm per animation would be the single biggest
// avoidable cost in this pipeline.
let wasmPromise: Promise<TLottieWasmExports> | null = null;
function getWasm(wasmUrl: string | undefined): Promise<TLottieWasmExports> {
	if (!wasmPromise)
		wasmPromise = loadWasmModule(wasmUrl ?? WORKER_DEFAULT_WASM_URL);
	return wasmPromise;
}

// self.requestAnimationFrame is available in a dedicated worker that owns an
// OffscreenCanvas in every evergreen engine we target; fall back to a timer
// otherwise so the loop still runs (e.g. under a test runner).
const raf: (cb: (t: number) => void) => number =
	typeof ctx.requestAnimationFrame === "function"
		? ctx.requestAnimationFrame.bind(ctx)
		: (cb) => setTimeout(() => cb(performance.now()), 16) as unknown as number;
const cancelRaf: (handle: number) => void =
	typeof ctx.cancelAnimationFrame === "function"
		? ctx.cancelAnimationFrame.bind(ctx)
		: (handle) => clearTimeout(handle);

const REPORT_INTERVAL_MS = 100; // ~10Hz cap on throttled 'frame' postMessages

class WorkerAnimation {
	private readonly id: string;
	private readonly wasm: TLottieWasmExports;
	private readonly animationBytes: Uint8Array;
	private readonly canvas: OffscreenCanvas;
	private readonly ctx2d: OffscreenCanvasRenderingContext2D;
	private readonly engine: PlayerEngine;
	private readonly quality: RenderQuality;
	private readonly forceRender: boolean;
	private readonly reportFrames: boolean;

	private instance: TLottieInstance;
	private width: number;
	private height: number;
	private observable = true;
	private loopRunning = false;
	private rafHandle = 0;
	private lastReportAt = 0;
	private destroyed = false;

	constructor(
		id: string,
		wasm: TLottieWasmExports,
		animationBytes: Uint8Array,
		instance: TLottieInstance,
		config: WorkerInitConfig,
	) {
		this.id = id;
		this.wasm = wasm;
		this.animationBytes = animationBytes;
		this.instance = instance;
		this.canvas = config.canvas;
		this.width = config.width;
		this.height = config.height;
		this.canvas.width = this.width;
		this.canvas.height = this.height;

		const ctx2d = this.canvas.getContext("2d");
		if (!ctx2d)
			throw new Error(
				"tlottie: failed to acquire a 2d context from the OffscreenCanvas",
			);
		this.ctx2d = ctx2d;

		this.quality = { ...DEFAULT_RENDER_QUALITY, ...config.quality };
		this.forceRender = config.forceRender ?? false;
		this.reportFrames = config.reportFrames ?? false;

		this.engine = new PlayerEngine({
			frameCount: instance.frameCount,
			frameRate: instance.frameRate,
			speed: config.speed,
			loop: config.loop,
			direction: config.direction,
			autoplay: config.autoplay,
		});

		for (const event of [
			"play",
			"pause",
			"stop",
			"complete",
			"loopComplete",
			"destroy",
		] as const) {
			this.engine.on(event, (frames) =>
				this.post({ type: "event", id: this.id, event, frames }),
			);
		}
		this.engine.on("play", () => this.ensureLoopRunning());
		if (this.reportFrames) {
			this.engine.on("frame", (frames) => {
				const now = performance.now();
				if (now - this.lastReportAt < REPORT_INTERVAL_MS) return;
				this.lastReportAt = now;
				this.post({ type: "event", id: this.id, event: "frame", frames });
			});
		}

		this.post({
			type: "meta",
			id: this.id,
			width: instance.width,
			height: instance.height,
			frameRate: instance.frameRate,
			frameCount: instance.frameCount,
		});

		this.draw();
		if (this.engine.state === "playing") this.ensureLoopRunning();
	}

	play(): void {
		this.engine.play();
	}

	pause(): void {
		this.engine.pause();
	}

	stop(): void {
		this.engine.stop();
		this.draw();
	}

	seek(frame: number): void {
		this.engine.seek(frame);
		this.draw();
	}

	setSpeed(speed: number): void {
		this.engine.setSpeed(speed);
	}

	setLoop(loop: WorkerInitConfig["loop"]): void {
		this.engine.setLoop(loop ?? false);
	}

	setDirection(direction: WorkerInitConfig["direction"]): void {
		this.engine.setDirection(direction ?? 1);
	}

	setObservable(observable: boolean): void {
		this.observable = observable;
		if (observable) this.draw();
	}

	resize(width: number, height: number): void {
		if (width === this.width && height === this.height) return;
		this.width = width;
		this.height = height;
		this.canvas.width = width;
		this.canvas.height = height;
		this.draw();
	}

	recolor(
		fitzModifier: WorkerInitConfig["fitzModifier"],
		layerColorReplacements: WorkerInitConfig["layerColorReplacements"],
	): void {
		const next = TLottieInstance.create(this.wasm, this.animationBytes, {
			fitzModifier,
			layerColorReplacements,
		});
		if (!next) {
			this.post({
				type: "error",
				id: this.id,
				error: {
					reason: "parse",
					message: "tlottie rejected the recolor options",
				},
			});
			return;
		}
		this.instance.drop();
		this.instance = next;
		this.engine.setFrameCount(next.frameCount);
		this.draw();
	}

	destroy(): void {
		this.destroyed = true;
		this.loopRunning = false;
		cancelRaf(this.rafHandle);
		this.engine.destroy();
		this.instance.drop();
	}

	private ensureLoopRunning(): void {
		if (this.loopRunning || this.destroyed) return;
		this.loopRunning = true;
		this.rafHandle = raf(this.tick);
	}

	private tick = (nowMs: number): void => {
		if (this.destroyed) {
			this.loopRunning = false;
			return;
		}
		const needsRedraw = this.engine.tick(nowMs);
		if (needsRedraw) this.draw();
		if (this.engine.state === "playing") {
			this.rafHandle = raf(this.tick);
		} else {
			this.loopRunning = false;
		}
	};

	private draw(): void {
		if (this.destroyed || !(this.observable || this.forceRender)) return;
		const pixels = this.instance.render(
			this.engine.currentFrame,
			this.width,
			this.height,
			this.quality,
		);
		if (!pixels) {
			this.post({
				type: "error",
				id: this.id,
				error: { reason: "wasm", message: "render failed" },
			});
			return;
		}
		this.ctx2d.putImageData(
			new ImageData(pixels, this.width, this.height),
			0,
			0,
		);
	}

	private post(message: WorkerToMainMessage): void {
		ctx.postMessage(message);
	}
}

const animations = new Map<string, WorkerAnimation>();
// Guards the race where an 'observability'/'resize' message for an id
// arrives before that id's 'init' has finished (async wasm/gzip work).
const pendingObservability = new Map<string, boolean>();

ctx.onmessage = (ev: MessageEvent<MainToWorkerMessage>) => {
	const msg = ev.data;
	switch (msg.type) {
		case "init":
			void handleInit(msg.id, msg.config);
			break;
		case "resize":
			animations.get(msg.id)?.resize(msg.width, msg.height);
			break;
		case "observability": {
			const anim = animations.get(msg.id);
			if (anim) anim.setObservable(msg.observable);
			else pendingObservability.set(msg.id, msg.observable);
			break;
		}
		case "control": {
			const anim = animations.get(msg.id);
			if (!anim) break;
			if (msg.action === "play") anim.play();
			else if (msg.action === "pause") anim.pause();
			else if (msg.action === "stop") anim.stop();
			else if (msg.action === "destroy") {
				anim.destroy();
				animations.delete(msg.id);
			}
			break;
		}
		case "tweak": {
			const anim = animations.get(msg.id);
			if (!anim) break;
			if (msg.action === "speed") anim.setSpeed(msg.value);
			else if (msg.action === "loop") anim.setLoop(msg.value);
			else if (msg.action === "direction") anim.setDirection(msg.value);
			else if (msg.action === "seek") anim.seek(msg.value);
			break;
		}
		case "recolor":
			animations
				.get(msg.id)
				?.recolor(msg.fitzModifier, msg.layerColorReplacements);
			break;
		case "warmup":
			void handleWarmup(msg.requestId, msg.wasmUrl);
			break;
	}
};

/** Loads (or reuses the already-loaded) wasm module with no canvas/animation involved — lets a caller pay the download+instantiate cost ahead of the first real player. */
async function handleWarmup(
	requestId: string,
	wasmUrl: string | undefined,
): Promise<void> {
	try {
		await getWasm(wasmUrl);
		ctx.postMessage({
			type: "warmed",
			requestId,
		} satisfies WorkerToMainMessage);
	} catch (error) {
		ctx.postMessage({
			type: "warmup-error",
			requestId,
			message: error instanceof Error ? error.message : String(error),
		} satisfies WorkerToMainMessage);
	}
}

async function handleInit(id: string, config: WorkerInitConfig): Promise<void> {
	let bytes: Uint8Array;
	try {
		bytes = await decodeAnimationBytes(config.animationData);
	} catch (error) {
		ctx.postMessage({
			type: "error",
			id,
			error: { reason: "decompress", message: String(error) },
		} satisfies WorkerToMainMessage);
		return;
	}

	let wasm: TLottieWasmExports;
	try {
		wasm = await getWasm(config.wasmUrl);
	} catch (error) {
		ctx.postMessage({
			type: "error",
			id,
			error: { reason: "wasm", message: String(error) },
		} satisfies WorkerToMainMessage);
		return;
	}

	const instance = TLottieInstance.create(wasm, bytes, {
		fitzModifier: config.fitzModifier,
		layerColorReplacements: config.layerColorReplacements,
	});
	if (!instance) {
		ctx.postMessage({
			type: "error",
			id,
			error: {
				reason: "parse",
				message: "tlottie rejected the animation data",
			},
		} satisfies WorkerToMainMessage);
		return;
	}

	const anim = new WorkerAnimation(id, wasm, bytes, instance, config);
	animations.set(id, anim);

	const pending = pendingObservability.get(id);
	if (pending !== undefined) {
		anim.setObservable(pending);
		pendingObservability.delete(id);
	}
}
