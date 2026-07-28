import { createSignal } from "solid-js";
import { LottiePlayer, type TLottie } from "../../src/solid/index.ts";
import outline from "../assets/outline.svg?raw";

export function App() {
	const [src, setSrc] = createSignal("/assets/sample.json");
	const [speed, setSpeed] = createSignal(1);
	const [loop, setLoop] = createSignal(true);
	const [direction, setDirection] = createSignal<1 | -1>(1);
	const [log, setLog] = createSignal<string[]>([]);
	let tlottie: TLottie | null = null;

	const appendLog = (line: string) =>
		setLog((prev) => [line, ...prev].slice(0, 40));

	return (
		<>
			<LottiePlayer
				src={src()}
				outline={outline}
				speed={speed()}
				loop={loop()}
				direction={direction()}
				autoplay
				workerCount={2}
				lottieRefCallback={(t) => {
					tlottie = t;
				}}
				onLoad={(p) => appendLog(`load ${JSON.stringify(p.frames)}`)}
				onError={(p) =>
					appendLog(`error ${p.error?.reason} — ${p.error?.message}`)
				}
				onComplete={() => appendLog("complete")}
			/>
			<div class="controls">
				<button type="button" onClick={() => tlottie?.play()}>
					Play
				</button>
				<button type="button" onClick={() => tlottie?.pause()}>
					Pause
				</button>
				<button type="button" onClick={() => tlottie?.stop()}>
					Stop
				</button>
				<label>
					Speed
					<input
						type="range"
						min="0.1"
						max="3"
						step="0.1"
						value={speed()}
						onInput={(e) => setSpeed(Number(e.currentTarget.value))}
					/>
				</label>
				<label>
					<input
						type="checkbox"
						checked={loop()}
						onChange={(e) => setLoop(e.currentTarget.checked)}
					/>
					Loop
				</label>
				<label>
					<input
						type="checkbox"
						checked={direction() === -1}
						onChange={(e) => setDirection(e.currentTarget.checked ? -1 : 1)}
					/>
					Reverse
				</label>
			</div>
			<div class="controls">
				<button type="button" onClick={() => setSrc("/assets/sample.tgs")}>
					Load .tgs (gzip)
				</button>
				<button
					type="button"
					onClick={() => setSrc("/assets/does-not-exist.json")}
				>
					Load bad URL (error demo)
				</button>
			</div>
			<pre class="status">{log().join("\n")}</pre>
		</>
	);
}
