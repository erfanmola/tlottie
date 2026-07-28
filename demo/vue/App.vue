<script setup lang="ts">
import { ref, shallowRef } from "vue";
import type { TLottie, TLottieEventPayload } from "../../src/main/TLottie.ts";
import { LottiePlayer } from "../../src/vue/index.ts";
import { assetUrl } from "../asset-url.ts";
import outline from "../assets/outline.svg?raw";

const src = ref(assetUrl("sample.json"));
const speed = ref(1);
const loop = ref(true);
const direction = ref<1 | -1>(1);
const log = ref<string[]>([]);
const tlottie = shallowRef<TLottie | null>(null);

function appendLog(line: string): void {
	log.value = [line, ...log.value].slice(0, 40);
}

function onLoad(p: TLottieEventPayload): void {
	appendLog(`load ${JSON.stringify(p.frames)}`);
}
function onError(p: TLottieEventPayload): void {
	appendLog(`error ${p.error?.reason} — ${p.error?.message}`);
}
</script>

<template>
	<LottiePlayer :src="src" :outline="outline" :speed="speed" :loop="loop" :direction="direction" autoplay :worker-count="2" :ref="(el: any) => (tlottie = el?.tlottie?.())" @load="onLoad" @error="onError" @complete="appendLog('complete')" />
	<div class="controls">
		<button type="button" @click="tlottie?.play()">Play</button>
		<button type="button" @click="tlottie?.pause()">Pause</button>
		<button type="button" @click="tlottie?.stop()">Stop</button>
		<label>
			Speed
			<input type="range" min="0.1" max="3" step="0.1" v-model.number="speed" @input="tlottie?.setSpeed(speed)" />
		</label>
		<label>
			<input type="checkbox" v-model="loop" @change="tlottie?.setLoop(loop)" />
			Loop
		</label>
		<label>
			<input type="checkbox" :checked="direction === -1" @change="direction = ($event.target as HTMLInputElement).checked ? -1 : 1; tlottie?.setDirection(direction)" />
			Reverse
		</label>
	</div>
	<div class="controls">
		<button type="button" @click="src = assetUrl('sample.tgs')">Load .tgs (gzip)</button>
		<button type="button" @click="src = assetUrl('does-not-exist.json')">Load bad URL (error demo)</button>
	</div>
	<pre class="status">{{ log.join("\n") }}</pre>
</template>
