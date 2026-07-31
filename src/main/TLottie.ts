import type {
	FitzModifier,
	LayerColorReplacementInput,
	LoopConfig,
	PlayDirection,
	PlayerEventName,
	PlayerFrameSnapshot,
	PlayerState,
	RenderQuality,
	TLottieColorConfig,
	TLottieError,
	TLottiePlaybackConfig,
	TLottieSource,
} from "../core/types.ts";
import { defaultWorkerPool, TLottieWorkerPool } from "../worker/pool.ts";
import type {
	MainToWorkerMessage,
	WorkerToMainMessage,
} from "../worker/protocol.ts";
import { fetchAnimationBytes } from "./cache.ts";
import { DEFAULT_WASM_URL } from "./wasm-url.ts";

export interface TLottieConfig
	extends TLottieSource,
		TLottiePlaybackConfig,
		TLottieColorConfig {
	canvas: HTMLCanvasElement;
	wasmUrl?: string | URL;
	quality?: Partial<RenderQuality>;
	/** Spins up a dedicated pool of this size just for this player, instead of using the shared default pool. */
	workerCount?: number;
	/** Advanced: bring your own worker pool (e.g. to share one across a subset of players). */
	pool?: TLottieWorkerPool;
	/** Keep rendering while off-screen (skips the IntersectionObserver pause). */
	forceRender?: boolean;
	/** Emit throttled (~10Hz) 'frame' events for progress UIs. Off by default — costs a postMessage per emission. */
	reportFrames?: boolean;
}

export type TLottieEventName = PlayerEventName | "error";

export interface TLottieEventPayload {
	frames?: PlayerFrameSnapshot;
	error?: TLottieError;
}

export type TLottieListener = (payload: TLottieEventPayload) => void;

/** Sets the default worker pool size for players that don't bring their own pool/workerCount. Call once, before creating players. */
export function configureTLottie(options: { workerCount?: number }): void {
	if (options.workerCount !== undefined)
		defaultWorkerPool.setSize(options.workerCount);
}

const intersectionRegistry = new Map<string, TLottie>();
const sharedIntersectionObserver: IntersectionObserver | null =
	typeof IntersectionObserver === "undefined"
		? null
		: new IntersectionObserver((entries) => {
				for (const entry of entries) {
					const id = (entry.target as HTMLElement).dataset.tlottieId;
					if (id)
						intersectionRegistry.get(id)?.setObservable(entry.isIntersecting);
				}
			});

let idCounter = 0;
function generateId(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
		return crypto.randomUUID();
	idCounter += 1;
	return `tlottie-${Date.now()}-${idCounter}`;
}

/** Main-thread facade over a worker-rendered Lottie/TGS animation. */
export class TLottie {
	readonly id = generateId();
	state: PlayerState = "loading";
	frames: PlayerFrameSnapshot = { current: 0, total: 0 };
	lastError: TLottieError | null = null;

	private readonly config: TLottieConfig;
	private readonly canvas: HTMLCanvasElement;
	private readonly pool: TLottieWorkerPool;
	private worker: Worker | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private resizeRaf = 0;
	private destroyed = false;
	private readonly listeners = new Map<
		TLottieEventName,
		Set<TLottieListener>
	>();

	constructor(config: TLottieConfig) {
		this.config = config;
		this.canvas = config.canvas;
		this.pool =
			config.pool ??
			(config.workerCount !== undefined
				? new TLottieWorkerPool(config.workerCount)
				: defaultWorkerPool);

		// Defer to the next frame: the caller's mount hook may run before the
		// canvas has committed layout, and getBoundingClientRect() below needs
		// real dimensions.
		requestAnimationFrame(() => {
			if (!this.destroyed) this.start();
		});
	}

	on(event: TLottieEventName, cb: TLottieListener): void {
		let set = this.listeners.get(event);
		if (!set) {
			set = new Set();
			this.listeners.set(event, set);
		}
		set.add(cb);
	}

	off(event: TLottieEventName, cb: TLottieListener): void {
		this.listeners.get(event)?.delete(cb);
	}

	play(): void {
		this.send({ type: "control", id: this.id, action: "play" });
	}

	pause(): void {
		this.send({ type: "control", id: this.id, action: "pause" });
	}

	stop(): void {
		this.send({ type: "control", id: this.id, action: "stop" });
	}

	seek(frame: number): void {
		this.send({ type: "tweak", id: this.id, action: "seek", value: frame });
	}

	setSpeed(speed: number): void {
		this.send({ type: "tweak", id: this.id, action: "speed", value: speed });
	}

	setLoop(loop: LoopConfig): void {
		this.send({ type: "tweak", id: this.id, action: "loop", value: loop });
	}

	setDirection(direction: PlayDirection): void {
		this.send({
			type: "tweak",
			id: this.id,
			action: "direction",
			value: direction,
		});
	}

	/** Re-parses the animation with a new Fitzpatrick modifier (parse-time only in the wasm core — this recreates the instance). */
	setFitzModifier(fitzModifier: FitzModifier): void {
		this.send({
			type: "recolor",
			id: this.id,
			fitzModifier,
			layerColorReplacements: this.config.layerColorReplacements,
		});
	}

	/** Re-parses the animation with new per-layer-prefix color overrides (parse-time only — this recreates the instance). */
	setLayerColors(layerColorReplacements: LayerColorReplacementInput[]): void {
		this.send({
			type: "recolor",
			id: this.id,
			fitzModifier: this.config.fitzModifier,
			layerColorReplacements,
		});
	}

	/** Called by the shared IntersectionObserver; also usable directly to force-pause/resume rendering. */
	setObservable(observable: boolean): void {
		this.send({ type: "observability", id: this.id, observable });
	}

	destroy(): void {
		if (this.destroyed) return;
		this.worker?.postMessage({
			type: "control",
			id: this.id,
			action: "destroy",
		} satisfies MainToWorkerMessage);
		this.destroyed = true;
		this.worker?.removeEventListener("message", this.onMessage);
		this.worker = null;
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		if (this.resizeRaf) cancelAnimationFrame(this.resizeRaf);
		sharedIntersectionObserver?.unobserve(this.canvas);
		intersectionRegistry.delete(this.id);
		this.listeners.clear();
	}

	private start(): void {
		this.canvas.dataset.tlottieId = this.id;

		const offscreen = this.canvas.transferControlToOffscreen();
		this.worker = this.pool.getWorker();
		this.worker.addEventListener("message", this.onMessage);

		intersectionRegistry.set(this.id, this);
		sharedIntersectionObserver?.observe(this.canvas);

		if (typeof ResizeObserver !== "undefined") {
			this.resizeObserver = new ResizeObserver(() => this.scheduleResize());
			this.resizeObserver.observe(this.canvas);
		}

		const { width, height } = this.measure();
		void this.loadAndInit(offscreen, width, height);
	}

	private async loadAndInit(
		offscreen: OffscreenCanvas,
		width: number,
		height: number,
	): Promise<void> {
		let bytes: Uint8Array;
		try {
			bytes = await this.resolveSourceBytes();
		} catch (error) {
			this.handleError({
				reason: "fetch",
				message: error instanceof Error ? error.message : String(error),
			});
			return;
		}
		if (this.destroyed || !this.worker) return;

		// Defensive copy: `bytes` may be a shared fetch-cache buffer (reused by
		// other players loading the same src) or a buffer the caller still
		// holds a reference to — transferring it directly would detach it out
		// from under them. The copy is transferred instead, at no extra net
		// cost versus letting postMessage structured-clone it.
		const payload = bytes.slice();
		const message: MainToWorkerMessage = {
			type: "init",
			id: this.id,
			config: {
				canvas: offscreen,
				animationData: payload,
				wasmUrl: (this.config.wasmUrl ?? DEFAULT_WASM_URL).toString(),
				width,
				height,
				speed: this.config.speed,
				loop: this.config.loop,
				direction: this.config.direction,
				autoplay: this.config.autoplay,
				fitzModifier: this.config.fitzModifier,
				layerColorReplacements: this.config.layerColorReplacements,
				quality: this.config.quality,
				forceRender: this.config.forceRender,
				reportFrames: this.config.reportFrames,
			},
		};
		this.worker.postMessage(message, [offscreen, payload.buffer]);
	}

	private async resolveSourceBytes(): Promise<Uint8Array> {
		const { data, src } = this.config;
		if (data !== undefined)
			return typeof data === "string" ? new TextEncoder().encode(data) : data;
		if (src) return fetchAnimationBytes(src);
		throw new Error("tlottie: TLottieConfig requires either `src` or `data`");
	}

	private measure(): { width: number; height: number } {
		const rect = this.canvas.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;
		return {
			width: Math.max(1, Math.round((rect.width || 1) * dpr)),
			height: Math.max(1, Math.round((rect.height || 1) * dpr)),
		};
	}

	private scheduleResize(): void {
		if (this.resizeRaf) return;
		this.resizeRaf = requestAnimationFrame(() => {
			this.resizeRaf = 0;
			if (this.destroyed) return;
			const { width, height } = this.measure();
			this.send({ type: "resize", id: this.id, width, height });
		});
	}

	private send(message: MainToWorkerMessage): void {
		if (this.destroyed || !this.worker) return;
		this.worker.postMessage(message);
	}

	private readonly onMessage = (
		ev: MessageEvent<WorkerToMainMessage>,
	): void => {
		const msg = ev.data;
		// "warmed"/"warmup-error" are initializeTLottie()'s responses, not
		// scoped to any TLottie instance — this handler only cares about
		// messages for its own animation id.
		if (msg.type === "warmed" || msg.type === "warmup-error") return;
		if (msg.id !== this.id) return;
		switch (msg.type) {
			case "meta":
				this.frames = { current: 0, total: msg.frameCount };
				this.state = "ready";
				this.emit("load", { frames: this.frames });
				break;
			case "event":
				this.frames = msg.frames;
				this.state = eventToState(msg.event, this.state);
				this.emit(msg.event, { frames: msg.frames });
				break;
			case "error":
				this.handleError(msg.error);
				break;
		}
	};

	private handleError(error: TLottieError): void {
		this.state = "error";
		this.lastError = error;
		this.emit("error", { error });
	}

	private emit(event: TLottieEventName, payload: TLottieEventPayload): void {
		const set = this.listeners.get(event);
		if (!set) return;
		for (const cb of set) cb(payload);
	}
}

function eventToState(
	event: PlayerEventName,
	current: PlayerState,
): PlayerState {
	switch (event) {
		case "play":
			return "playing";
		case "pause":
			return "paused";
		case "stop":
			return "stopped";
		case "complete":
			return "complete";
		default:
			return current;
	}
}
