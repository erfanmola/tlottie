<script lang="ts">
import { untrack } from "svelte";
import "../style/shimmer.scss";
import { buildShimmerMaskStyle } from "../main/shimmer.ts";
import {
	TLottie,
	type TLottieConfig,
	type TLottieEventPayload,
} from "../main/TLottie.ts";

interface Props extends Omit<TLottieConfig, "canvas"> {
	outline?: string;
	class?: string;
	onLoad?: (payload: TLottieEventPayload) => void;
	onError?: (payload: TLottieEventPayload) => void;
	onComplete?: (payload: TLottieEventPayload) => void;
	lottieRefCallback?: (tlottie: TLottie | null) => void;
}

let {
	src,
	data,
	speed,
	loop,
	direction,
	autoplay,
	fitzModifier,
	layerColorReplacements,
	quality,
	workerCount,
	pool,
	forceRender,
	reportFrames,
	wasmUrl,
	outline,
	class: className,
	onLoad,
	onError,
	onComplete,
	lottieRefCallback,
}: Props = $props();

let canvasEl: HTMLCanvasElement | undefined = $state();
let loaded = $state(false);
let errored = $state(false);
let tlottie: TLottie | null = null;

// transferControlToOffscreen() can only run once per canvas element ever
// — {#key sourceKey} below tears down and recreates the <canvas> (a new
// element bound to canvasEl) whenever src/data identity changes, and
// this effect re-runs because it reads canvasEl. `untrack` keeps the
// other config fields from also being tracked here — otherwise every
// speed/loop/direction change would tear down and remount too, instead
// of applying live via the effects below.
const sourceKey = $derived(
	src !== undefined
		? `src:${src}`
		: typeof data === "string"
			? `data:${data}`
			: data !== undefined
				? "data:binary"
				: "empty",
);

$effect(() => {
	if (!canvasEl) return;
	const canvas = canvasEl;
	loaded = false;
	errored = false;

	tlottie = untrack(
		() =>
			new TLottie({
				canvas,
				src,
				data,
				speed,
				loop,
				direction,
				autoplay,
				fitzModifier,
				layerColorReplacements,
				quality,
				workerCount,
				pool,
				forceRender,
				reportFrames,
				wasmUrl,
			}),
	);
	lottieRefCallback?.(tlottie);

	const handleLoad = (payload: TLottieEventPayload) => {
		loaded = true;
		errored = false;
		onLoad?.(payload);
	};
	const handleError = (payload: TLottieEventPayload) => {
		errored = true;
		onError?.(payload);
	};
	const handleComplete = (payload: TLottieEventPayload) =>
		onComplete?.(payload);
	tlottie.on("load", handleLoad);
	tlottie.on("error", handleError);
	tlottie.on("complete", handleComplete);

	return () => {
		tlottie?.off("load", handleLoad);
		tlottie?.off("error", handleError);
		tlottie?.off("complete", handleComplete);
		lottieRefCallback?.(null);
		tlottie?.destroy();
		tlottie = null;
	};
});

// Playback tweaks apply live instead of tearing down and re-fetching.
$effect(() => {
	if (speed !== undefined) tlottie?.setSpeed(speed);
});
$effect(() => {
	if (loop !== undefined) tlottie?.setLoop(loop);
});
$effect(() => {
	if (direction !== undefined) tlottie?.setDirection(direction);
});
$effect(() => {
	if (fitzModifier !== undefined) tlottie?.setFitzModifier(fitzModifier);
});

const shimmerStyle = $derived(outline ? buildShimmerMaskStyle(outline) : null);
</script>

<div class={className ? `tlottie-player ${className}` : "tlottie-player"}>
	{#key sourceKey}
		<canvas bind:this={canvasEl} class={loaded ? "tlottie-ready" : undefined}></canvas>
	{/key}
	{#if outline}
		<div class={!loaded || errored ? "tlottie-shimmer" : "tlottie-shimmer tlottie-hidden"} style:mask-image={shimmerStyle?.maskImage} style:-webkit-mask-image={shimmerStyle?.WebkitMaskImage}></div>
	{/if}
</div>
