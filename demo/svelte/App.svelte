<script lang="ts">
import type { TLottie, TLottieEventPayload } from "../../src/main/TLottie.ts";
import { LottiePlayer } from "../../src/svelte/index.ts";
import { assetUrl } from "../asset-url.ts";
import outline from "../assets/outline.svg?raw";

let src = $state(assetUrl("sample.json"));
let speed = $state(1);
let loop = $state(true);
let direction: 1 | -1 = $state(1);
let log: string[] = $state([]);
let tlottie: TLottie | null = null;

function appendLog(line: string): void {
	log = [line, ...log].slice(0, 40);
}
function onLoad(p: TLottieEventPayload): void {
	appendLog(`load ${JSON.stringify(p.frames)}`);
}
function onError(p: TLottieEventPayload): void {
	appendLog(`error ${p.error?.reason} — ${p.error?.message}`);
}
</script>

<LottiePlayer
	{src}
	{outline}
	{speed}
	{loop}
	{direction}
	autoplay
	workerCount={2}
	lottieRefCallback={(t) => (tlottie = t)}
	{onLoad}
	{onError}
	onComplete={() => appendLog("complete")}
/>
<div class="controls">
	<button type="button" onclick={() => tlottie?.play()}>Play</button>
	<button type="button" onclick={() => tlottie?.pause()}>Pause</button>
	<button type="button" onclick={() => tlottie?.stop()}>Stop</button>
	<label>
		Speed
		<input type="range" min="0.1" max="3" step="0.1" bind:value={speed} />
	</label>
	<label>
		<input type="checkbox" bind:checked={loop} />
		Loop
	</label>
	<label>
		<input type="checkbox" checked={direction === -1} onchange={(e) => (direction = e.currentTarget.checked ? -1 : 1)} />
		Reverse
	</label>
</div>
<div class="controls">
	<button type="button" onclick={() => (src = assetUrl("sample.tgs"))}>Load .tgs (gzip)</button>
	<button type="button" onclick={() => (src = assetUrl("does-not-exist.json"))}>Load bad URL (error demo)</button>
</div>
<pre class="status">{log.join("\n")}</pre>
