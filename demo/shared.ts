import type { TLottie } from "../src/main/TLottie.ts";

/** Wires a plain-DOM control panel (play/pause/stop/seek/speed/loop/direction) to a TLottie instance — shared by the vanilla and web component demos. */
export function attachControls(
	controls: HTMLElement,
	status: HTMLElement,
	tlottie: TLottie,
): void {
	let seeking = false;

	const log = (...args: unknown[]): void => {
		status.textContent =
			`${args.map(String).join(" ")}\n${status.textContent}`.slice(0, 4000);
	};
	tlottie.on("load", (p) => log("load", JSON.stringify(p.frames)));
	tlottie.on("error", (p) => log("error", p.error?.reason, p.error?.message));
	tlottie.on("complete", () => log("complete"));

	const button = (label: string, onClick: () => void): void => {
		const btn = document.createElement("button");
		btn.textContent = label;
		btn.addEventListener("click", onClick);
		controls.appendChild(btn);
	};

	button("Play", () => tlottie.play());
	button("Pause", () => tlottie.pause());
	button("Stop", () => tlottie.stop());

	const speedLabel = document.createElement("label");
	speedLabel.append("Speed ");
	const speedInput = document.createElement("input");
	speedInput.type = "range";
	speedInput.min = "0.1";
	speedInput.max = "3";
	speedInput.step = "0.1";
	speedInput.value = "1";
	speedInput.addEventListener("input", () =>
		tlottie.setSpeed(Number(speedInput.value)),
	);
	speedLabel.appendChild(speedInput);
	controls.appendChild(speedLabel);

	const loopLabel = document.createElement("label");
	const loopInput = document.createElement("input");
	loopInput.type = "checkbox";
	loopInput.checked = true;
	loopInput.addEventListener("change", () =>
		tlottie.setLoop(loopInput.checked),
	);
	loopLabel.append(loopInput, "Loop");
	controls.appendChild(loopLabel);

	const dirLabel = document.createElement("label");
	const dirInput = document.createElement("input");
	dirInput.type = "checkbox";
	dirInput.addEventListener("change", () =>
		tlottie.setDirection(dirInput.checked ? -1 : 1),
	);
	dirLabel.append(dirInput, "Reverse");
	controls.appendChild(dirLabel);

	const seekLabel = document.createElement("label");
	seekLabel.append("Seek ");
	const seekInput = document.createElement("input");
	seekInput.type = "range";
	seekInput.min = "0";
	seekInput.max = "0";
	seekInput.value = "0";
	seekInput.addEventListener("pointerdown", () => {
		seeking = true;
	});
	seekInput.addEventListener("pointerup", () => {
		seeking = false;
	});
	seekInput.addEventListener("input", () =>
		tlottie.seek(Number(seekInput.value)),
	);
	seekLabel.appendChild(seekInput);
	controls.appendChild(seekLabel);

	// TLottie doesn't emit a per-frame event by default (reportFrames must be
	// opted into, and even then it's throttled) — a light poll is simpler
	// than wiring reportFrames just to keep a demo scrubber in sync.
	setInterval(() => {
		seekInput.max = String(Math.max(0, tlottie.frames.total - 1));
		if (!seeking) seekInput.value = String(tlottie.frames.current);
	}, 100);
}
