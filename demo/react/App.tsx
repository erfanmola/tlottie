import { useRef, useState } from "react";
import { LottiePlayer, type TLottie } from "../../src/react/index.ts";
import outline from "../assets/outline.svg?raw";

export function App() {
	const [src, setSrc] = useState("/assets/sample.json");
	const [speed, setSpeed] = useState(1);
	const [loop, setLoop] = useState(true);
	const [direction, setDirection] = useState<1 | -1>(1);
	const [log, setLog] = useState<string[]>([]);
	const tlottieRef = useRef<TLottie | null>(null);

	const appendLog = (line: string) =>
		setLog((prev) => [line, ...prev].slice(0, 40));

	return (
		<>
			<LottiePlayer
				src={src}
				outline={outline}
				speed={speed}
				loop={loop}
				direction={direction}
				autoplay
				workerCount={2}
				lottieRefCallback={(t) => {
					tlottieRef.current = t;
				}}
				onLoad={(p) => appendLog(`load ${JSON.stringify(p.frames)}`)}
				onError={(p) =>
					appendLog(`error ${p.error?.reason} — ${p.error?.message}`)
				}
				onComplete={() => appendLog("complete")}
			/>
			<div className="controls">
				<button type="button" onClick={() => tlottieRef.current?.play()}>
					Play
				</button>
				<button type="button" onClick={() => tlottieRef.current?.pause()}>
					Pause
				</button>
				<button type="button" onClick={() => tlottieRef.current?.stop()}>
					Stop
				</button>
				<label>
					Speed
					<input
						type="range"
						min="0.1"
						max="3"
						step="0.1"
						value={speed}
						onChange={(e) => setSpeed(Number(e.target.value))}
					/>
				</label>
				<label>
					<input
						type="checkbox"
						checked={loop}
						onChange={(e) => setLoop(e.target.checked)}
					/>
					Loop
				</label>
				<label>
					<input
						type="checkbox"
						checked={direction === -1}
						onChange={(e) => setDirection(e.target.checked ? -1 : 1)}
					/>
					Reverse
				</label>
			</div>
			<div className="controls">
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
			<pre className="status">{log.join("\n")}</pre>
		</>
	);
}
