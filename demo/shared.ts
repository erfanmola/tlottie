import type { TLottie, TLottieEventPayload } from "../src/main/TLottie.ts";

export interface ControlsHandle {
	/** Point the (already-built) control panel at a new TLottie instance — swaps event listeners, doesn't touch the DOM. */
	rebind(tlottie: TLottie): void;
}

/**
 * Wires a plain-DOM control panel (play/pause/stop/seek/speed/loop/direction)
 * to a TLottie instance — shared by the vanilla and web component demos.
 * Builds the DOM once; call `.rebind(tlottie)` whenever the demo swaps in a
 * new TLottie instance (e.g. the "load .tgs" / "load bad url" buttons)
 * instead of calling this again, which would duplicate every button.
 */
export function attachControls(
	controls: HTMLElement,
	status: HTMLElement,
	initialTlottie: TLottie,
): ControlsHandle {
	let current = initialTlottie;
	let seeking = false;

	const log = (...args: unknown[]): void => {
		status.textContent =
			`${args.map(String).join(" ")}\n${status.textContent}`.slice(0, 4000);
	};

	const handleLoad = (p: TLottieEventPayload) =>
		log("load", JSON.stringify(p.frames));
	const handleError = (p: TLottieEventPayload) =>
		log("error", p.error?.reason, p.error?.message);
	const handleComplete = () => log("complete");

	function bindEvents(tlottie: TLottie): void {
		tlottie.on("load", handleLoad);
		tlottie.on("error", handleError);
		tlottie.on("complete", handleComplete);
	}

	function unbindEvents(tlottie: TLottie): void {
		tlottie.off("load", handleLoad);
		tlottie.off("error", handleError);
		tlottie.off("complete", handleComplete);
	}

	bindEvents(current);

	const button = (label: string, onClick: () => void): void => {
		const btn = document.createElement("button");
		btn.textContent = label;
		btn.addEventListener("click", onClick);
		controls.appendChild(btn);
	};

	button("Play", () => current.play());
	button("Pause", () => current.pause());
	button("Stop", () => current.stop());

	const speedLabel = document.createElement("label");
	speedLabel.append("Speed ");
	const speedInput = document.createElement("input");
	speedInput.type = "range";
	speedInput.min = "0.1";
	speedInput.max = "3";
	speedInput.step = "0.1";
	speedInput.value = "1";
	speedInput.addEventListener("input", () =>
		current.setSpeed(Number(speedInput.value)),
	);
	speedLabel.appendChild(speedInput);
	controls.appendChild(speedLabel);

	const loopLabel = document.createElement("label");
	const loopInput = document.createElement("input");
	loopInput.type = "checkbox";
	loopInput.checked = true;
	loopInput.addEventListener("change", () =>
		current.setLoop(loopInput.checked),
	);
	loopLabel.append(loopInput, "Loop");
	controls.appendChild(loopLabel);

	const dirLabel = document.createElement("label");
	const dirInput = document.createElement("input");
	dirInput.type = "checkbox";
	dirInput.addEventListener("change", () =>
		current.setDirection(dirInput.checked ? -1 : 1),
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
		current.seek(Number(seekInput.value)),
	);
	seekLabel.appendChild(seekInput);
	controls.appendChild(seekLabel);

	// TLottie doesn't emit a per-frame event by default (reportFrames must be
	// opted into, and even then it's throttled) — a light poll is simpler
	// than wiring reportFrames just to keep a demo scrubber in sync. Reads
	// `current` fresh every tick, so it stays correct across rebind().
	setInterval(() => {
		seekInput.max = String(Math.max(0, current.frames.total - 1));
		if (!seeking) seekInput.value = String(current.frames.current);
	}, 100);

	return {
		rebind(tlottie: TLottie): void {
			unbindEvents(current);
			current = tlottie;
			bindEvents(current);
			seeking = false;
			seekInput.value = "0";
		},
	};
}
