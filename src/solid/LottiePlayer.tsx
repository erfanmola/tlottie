import {
	type ComponentProps,
	createEffect,
	createMemo,
	createSignal,
	type JSX,
	on,
	onCleanup,
	Show,
	splitProps,
} from "solid-js";
import "../style/shimmer.scss";
import { buildShimmerMaskStyle } from "../main/shimmer.ts";
import {
	TLottie,
	type TLottieConfig,
	type TLottieEventPayload,
} from "../main/TLottie.ts";

export interface LottiePlayerProps
	extends Omit<TLottieConfig, "canvas">,
		Omit<ComponentProps<"div">, "onLoad" | "onError"> {
	/** Raw SVG string used as a loading/error skeleton via CSS mask-image. */
	outline?: string;
	onLoad?: (payload: TLottieEventPayload) => void;
	onError?: (payload: TLottieEventPayload) => void;
	onComplete?: (payload: TLottieEventPayload) => void;
	lottieRefCallback?: (tlottie: TLottie | null) => void;
}

const CONFIG_KEYS = [
	"src",
	"data",
	"speed",
	"loop",
	"direction",
	"autoplay",
	"fitzModifier",
	"layerColorReplacements",
	"quality",
	"workerCount",
	"pool",
	"forceRender",
	"reportFrames",
	"wasmUrl",
] as const;
const OWN_KEYS = [
	"outline",
	"onLoad",
	"onError",
	"onComplete",
	"lottieRefCallback",
	"class",
	"classList",
] as const;

export function LottiePlayer(props: LottiePlayerProps): JSX.Element {
	const [config, own, rest] = splitProps(props, CONFIG_KEYS, OWN_KEYS);
	const [loaded, setLoaded] = createSignal(false);
	const [errored, setErrored] = createSignal(false);

	// transferControlToOffscreen() can only run once per canvas element ever
	// — <Show keyed> tears down and remounts its children (a fresh <canvas>,
	// re-running onMount) whenever src/data identity changes, instead of
	// reusing an already-transferred canvas.
	const sourceKey = createMemo(() =>
		config.src !== undefined
			? `src:${config.src}`
			: typeof config.data === "string"
				? `data:${config.data}`
				: config.data !== undefined
					? "data:binary"
					: "empty",
	);

	const shimmerStyle = () =>
		own.outline ? buildShimmerMaskStyle(own.outline) : null;

	return (
		<div
			class={own.class ? `tlottie-player ${own.class}` : "tlottie-player"}
			classList={own.classList}
			{...rest}
		>
			<Show when={sourceKey()} keyed>
				{(_key) => {
					let canvasEl!: HTMLCanvasElement;
					let tlottie: TLottie | null = null;

					const attach = (el: HTMLCanvasElement) => {
						canvasEl = el;
						setLoaded(false);
						setErrored(false);
						tlottie = new TLottie({ canvas: canvasEl, ...config });
						own.lottieRefCallback?.(tlottie);

						const handleLoad = (payload: TLottieEventPayload) => {
							setLoaded(true);
							setErrored(false);
							own.onLoad?.(payload);
						};
						const handleError = (payload: TLottieEventPayload) => {
							setErrored(true);
							own.onError?.(payload);
						};
						const handleComplete = (payload: TLottieEventPayload) =>
							own.onComplete?.(payload);
						tlottie.on("load", handleLoad);
						tlottie.on("error", handleError);
						tlottie.on("complete", handleComplete);

						onCleanup(() => {
							tlottie?.off("load", handleLoad);
							tlottie?.off("error", handleError);
							tlottie?.off("complete", handleComplete);
							own.lottieRefCallback?.(null);
							tlottie?.destroy();
							tlottie = null;
						});
					};

					// Playback tweaks apply live instead of tearing down and re-fetching.
					createEffect(
						on(
							() => config.speed,
							(speed) => {
								if (speed !== undefined) tlottie?.setSpeed(speed);
							},
							{ defer: true },
						),
					);
					createEffect(
						on(
							() => config.loop,
							(loop) => {
								if (loop !== undefined) tlottie?.setLoop(loop);
							},
							{ defer: true },
						),
					);
					createEffect(
						on(
							() => config.direction,
							(direction) => {
								if (direction !== undefined) tlottie?.setDirection(direction);
							},
							{ defer: true },
						),
					);
					createEffect(
						on(
							() => config.fitzModifier,
							(fitzModifier) => {
								if (fitzModifier !== undefined)
									tlottie?.setFitzModifier(fitzModifier);
							},
							{ defer: true },
						),
					);

					return (
						<canvas ref={attach} classList={{ "tlottie-ready": loaded() }} />
					);
				}}
			</Show>
			<Show when={own.outline}>
				{(_outline) => (
					<div
						class="tlottie-shimmer"
						classList={{ "tlottie-hidden": loaded() && !errored() }}
						style={{
							"mask-image": shimmerStyle()?.maskImage,
							"-webkit-mask-image": shimmerStyle()?.WebkitMaskImage,
						}}
					/>
				)}
			</Show>
		</div>
	);
}
