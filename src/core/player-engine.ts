import type {
	LoopConfig,
	PlayDirection,
	PlayerEngineConfig,
	PlayerEventName,
	PlayerFrameSnapshot,
	PlayerState,
} from "./types.ts";

type Listener = (frames: PlayerFrameSnapshot) => void;

// A backgrounded tab can deliver a single rAF tick with a huge `dt` when it
// regains focus; clamping keeps the playhead from leaping instead of
// resuming smoothly.
const MAX_TICK_DELTA_MS = 100;

/**
 * Framework- and DOM-agnostic playback clock. Runs inside the worker,
 * driven by its render loop's rAF timestamp — never touches wasm, canvas,
 * or postMessage directly, so it's trivial to unit test in isolation.
 */
export class PlayerEngine {
	state: PlayerState = "ready";

	private frame: number;
	private frameCount: number;
	private frameRate: number;
	private speed: number;
	private loop: LoopConfig;
	private direction: PlayDirection;
	private loopsCompleted = 0;
	private lastTickAt = 0;
	private listeners = new Map<PlayerEventName, Set<Listener>>();

	constructor(config: PlayerEngineConfig) {
		this.frameCount = config.frameCount;
		this.frameRate = config.frameRate;
		this.speed = config.speed ?? 1;
		this.loop = config.loop ?? false;
		this.direction = config.direction ?? 1;
		this.frame = clampFrame(
			config.initialFrame ?? (this.direction === 1 ? 0 : this.frameCount - 1),
			this.frameCount,
		);
		if (config.autoplay ?? true) this.play();
	}

	get currentFrame(): number {
		return this.frame;
	}

	get snapshot(): PlayerFrameSnapshot {
		return { current: this.frame, total: this.frameCount };
	}

	on(event: PlayerEventName, cb: Listener): void {
		let set = this.listeners.get(event);
		if (!set) {
			set = new Set();
			this.listeners.set(event, set);
		}
		set.add(cb);
	}

	off(event: PlayerEventName, cb: Listener): void {
		this.listeners.get(event)?.delete(cb);
	}

	play(): void {
		if (this.state === "destroyed" || this.state === "error") return;
		if (this.state === "complete") {
			this.frame = this.direction === 1 ? 0 : this.frameCount - 1;
			this.loopsCompleted = 0;
		}
		this.state = "playing";
		this.lastTickAt = 0;
		this.emit("play");
	}

	pause(): void {
		if (this.state !== "playing") return;
		this.state = "paused";
		this.emit("pause");
	}

	stop(): void {
		if (this.state === "destroyed" || this.state === "error") return;
		this.state = "stopped";
		this.frame = this.direction === 1 ? 0 : this.frameCount - 1;
		this.lastTickAt = 0;
		this.emit("stop");
		this.emit("frame");
	}

	seek(frame: number): void {
		if (this.state === "destroyed" || this.state === "error") return;
		this.frame = clampFrame(frame, this.frameCount);
		this.lastTickAt = 0;
		if (this.state === "complete" || this.state === "stopped")
			this.state = "paused";
		this.emit("frame");
	}

	setSpeed(speed: number): void {
		this.speed = speed;
	}

	setLoop(loop: LoopConfig): void {
		this.loop = loop;
	}

	setDirection(direction: PlayDirection): void {
		this.direction = direction;
	}

	/** Call after re-creating the wasm instance (e.g. after a recolor) with the new frame count. */
	setFrameCount(frameCount: number): void {
		this.frameCount = frameCount;
		this.frame = clampFrame(this.frame, frameCount);
	}

	/**
	 * Advances the clock from a render-loop timestamp. Returns true if
	 * `currentFrame` changed (or a redraw is otherwise due) and the caller
	 * should render.
	 */
	tick(nowMs: number): boolean {
		if (this.state !== "playing") return false;
		if (!this.lastTickAt) {
			// First tick after (re)start: draw the current frame without
			// advancing, so play() from a paused state doesn't skip a frame.
			this.lastTickAt = nowMs;
			return true;
		}

		const dt = Math.min(nowMs - this.lastTickAt, MAX_TICK_DELTA_MS);
		this.lastTickAt = nowMs;
		const deltaFrames =
			(dt / 1000) * this.frameRate * this.speed * this.direction;
		let next = this.frame + deltaFrames;

		if (next >= this.frameCount || next < 0) {
			this.loopsCompleted++;
			const shouldLoop =
				this.loop === true ||
				(typeof this.loop === "number" && this.loopsCompleted < this.loop);
			if (shouldLoop) {
				next = ((next % this.frameCount) + this.frameCount) % this.frameCount;
				this.frame = next;
				this.emit("frame");
				this.emit("loopComplete");
				return true;
			}
			this.frame = this.direction === 1 ? this.frameCount - 1 : 0;
			this.state = "complete";
			this.emit("frame");
			this.emit("complete");
			return true;
		}

		this.frame = next;
		this.emit("frame");
		return true;
	}

	destroy(): void {
		this.state = "destroyed";
		this.emit("destroy");
		this.listeners.clear();
	}

	private emit(event: PlayerEventName): void {
		const set = this.listeners.get(event);
		if (!set) return;
		const frames = this.snapshot;
		for (const cb of set) cb(frames);
	}
}

function clampFrame(frame: number, frameCount: number): number {
	if (frameCount <= 0) return 0;
	return Math.min(Math.max(frame, 0), frameCount - 1);
}
