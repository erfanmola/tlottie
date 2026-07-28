<script setup lang="ts">
import {
	computed,
	nextTick,
	onBeforeUnmount,
	onMounted,
	ref,
	shallowRef,
	watch,
} from "vue";
import "../style/shimmer.scss";
import type {
	FitzModifier,
	LayerColorReplacementInput,
	LoopConfig,
	PlayDirection,
	RenderQuality,
} from "../core/types.ts";
import { buildShimmerMaskStyle } from "../main/shimmer.ts";
import { TLottie, type TLottieEventPayload } from "../main/TLottie.ts";
import type { TLottieWorkerPool } from "../worker/pool.ts";

// Vue's `defineProps<T>()` macro resolves prop types by statically analyzing
// the interface — it can't follow a cross-file `Omit<TLottieConfig, ...>`
// generic, so the fields are spelled out flat here instead of extending
// TLottieConfig like the other framework adapters do.
export interface LottiePlayerProps {
	src?: string;
	data?: string | Uint8Array;
	speed?: number;
	loop?: LoopConfig;
	direction?: PlayDirection;
	autoplay?: boolean;
	fitzModifier?: FitzModifier;
	layerColorReplacements?: LayerColorReplacementInput[];
	quality?: Partial<RenderQuality>;
	wasmUrl?: string | URL;
	workerCount?: number;
	pool?: TLottieWorkerPool;
	forceRender?: boolean;
	reportFrames?: boolean;
	outline?: string;
	class?: string;
}

const props = defineProps<LottiePlayerProps>();
const emit = defineEmits<{
	load: [payload: TLottieEventPayload];
	error: [payload: TLottieEventPayload];
	complete: [payload: TLottieEventPayload];
}>();
defineExpose({ tlottie: () => tlottieRef.value });

const canvasEl = ref<HTMLCanvasElement | null>(null);
const tlottieRef = shallowRef<TLottie | null>(null);
const loaded = ref(false);
const errored = ref(false);

// transferControlToOffscreen() can only run once per canvas element ever —
// keying the canvas on source identity forces Vue to replace the DOM node
// (instead of reusing an already-transferred one) whenever src/data
// changes, and the watcher below re-mounts TLottie against the new node.
const sourceKey = computed(() =>
	props.src !== undefined
		? `src:${props.src}`
		: typeof props.data === "string"
			? `data:${props.data}`
			: props.data !== undefined
				? "data:binary"
				: "empty",
);

let handleLoad: ((payload: TLottieEventPayload) => void) | null = null;
let handleError: ((payload: TLottieEventPayload) => void) | null = null;
let handleComplete: ((payload: TLottieEventPayload) => void) | null = null;

function mount(): void {
	if (!canvasEl.value) return;
	loaded.value = false;
	errored.value = false;
	const tlottie = new TLottie({
		canvas: canvasEl.value,
		src: props.src,
		data: props.data,
		speed: props.speed,
		loop: props.loop,
		direction: props.direction,
		autoplay: props.autoplay,
		fitzModifier: props.fitzModifier,
		layerColorReplacements: props.layerColorReplacements,
		quality: props.quality,
		workerCount: props.workerCount,
		pool: props.pool,
		forceRender: props.forceRender,
		reportFrames: props.reportFrames,
		wasmUrl: props.wasmUrl,
	});
	tlottieRef.value = tlottie;

	handleLoad = (payload) => {
		loaded.value = true;
		errored.value = false;
		emit("load", payload);
	};
	handleError = (payload) => {
		errored.value = true;
		emit("error", payload);
	};
	handleComplete = (payload) => emit("complete", payload);
	tlottie.on("load", handleLoad);
	tlottie.on("error", handleError);
	tlottie.on("complete", handleComplete);
}

function unmount(): void {
	const tlottie = tlottieRef.value;
	if (!tlottie) return;
	if (handleLoad) tlottie.off("load", handleLoad);
	if (handleError) tlottie.off("error", handleError);
	if (handleComplete) tlottie.off("complete", handleComplete);
	tlottie.destroy();
	tlottieRef.value = null;
}

onMounted(mount);
onBeforeUnmount(unmount);

watch(sourceKey, async () => {
	unmount();
	await nextTick(); // let the :key change replace the <canvas> element first
	mount();
});

// Playback tweaks apply live instead of tearing down and re-fetching.
watch(
	() => props.speed,
	(speed) => {
		if (speed !== undefined) tlottieRef.value?.setSpeed(speed);
	},
);
watch(
	() => props.loop,
	(loop) => {
		if (loop !== undefined) tlottieRef.value?.setLoop(loop);
	},
);
watch(
	() => props.direction,
	(direction) => {
		if (direction !== undefined) tlottieRef.value?.setDirection(direction);
	},
);
watch(
	() => props.fitzModifier,
	(fitzModifier) => {
		if (fitzModifier !== undefined)
			tlottieRef.value?.setFitzModifier(fitzModifier);
	},
);

const shimmerStyle = () =>
	props.outline ? buildShimmerMaskStyle(props.outline) : null;
</script>

<template>
	<div :class="props.class ? `tlottie-player ${props.class}` : 'tlottie-player'">
		<canvas :key="sourceKey" ref="canvasEl" :class="{ 'tlottie-ready': loaded }" />
		<div
			v-if="props.outline"
			class="tlottie-shimmer"
			:class="{ 'tlottie-hidden': loaded && !errored }"
			:style="{ maskImage: shimmerStyle()?.maskImage, WebkitMaskImage: shimmerStyle()?.WebkitMaskImage }"
		/>
	</div>
</template>
