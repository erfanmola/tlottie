/** Telegram Fitzpatrick skin-tone modifier, matches `FitzModifier` in tlottie/src/composition/options.rs. */
export const FitzModifier = {
	None: 0,
	Type12: 1,
	Type3: 2,
	Type4: 3,
	Type5: 4,
	Type6: 5,
} as const;
export type FitzModifier = (typeof FitzModifier)[keyof typeof FitzModifier];

/** Parse-time recolor of every fill/stroke under layers whose `nm` starts with `layerNamePrefix`. */
export interface LayerColorReplacementInput {
	layerNamePrefix: string;
	/** Straight-alpha color, 0xAARRGGBB. */
	color: number;
}

export interface RenderQuality {
	antialias: boolean;
	/** Maximum curve-flattening error, in device pixels. Must be finite and > 0. */
	curveTolerance: number;
}

export const DEFAULT_RENDER_QUALITY: RenderQuality = {
	antialias: true,
	curveTolerance: 0.125,
};

export type PlayerState =
	| "idle"
	| "loading"
	| "ready"
	| "playing"
	| "paused"
	| "stopped"
	| "complete"
	| "error"
	| "destroyed";

export type PlayerEventName =
	| "load"
	| "frame"
	| "loopComplete"
	| "complete"
	| "play"
	| "pause"
	| "stop"
	| "error"
	| "destroy";

export interface PlayerFrameSnapshot {
	current: number;
	total: number;
}

export type PlayDirection = 1 | -1;

/** `true` = loop forever, `false` = play once, `number` = play that many times total. */
export type LoopConfig = boolean | number;

export interface PlayerEngineConfig {
	frameCount: number;
	frameRate: number;
	speed?: number;
	loop?: LoopConfig;
	direction?: PlayDirection;
	autoplay?: boolean;
	initialFrame?: number;
}

/** Data source for an animation: a URL to fetch, or already-loaded bytes/JSON text. */
export interface TLottieSource {
	src?: string;
	data?: string | Uint8Array;
}

export interface TLottiePlaybackConfig {
	speed?: number;
	loop?: LoopConfig;
	direction?: PlayDirection;
	autoplay?: boolean;
}

export interface TLottieColorConfig {
	fitzModifier?: FitzModifier;
	layerColorReplacements?: LayerColorReplacementInput[];
}

/** Reason an 'error' event was raised. */
export type TLottieErrorReason = "fetch" | "decompress" | "parse" | "wasm";

export interface TLottieError {
	reason: TLottieErrorReason;
	message: string;
}
