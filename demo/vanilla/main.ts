import {
	configureTLottie,
	createTLottiePlayer,
	type TLottiePlayerHandle,
} from "../../src/vanilla/index.ts";
import { assetUrl } from "../asset-url.ts";
import outline from "../assets/outline.svg?raw";
import { attachControls } from "../shared.ts";

configureTLottie({ workerCount: 2 });

const playerContainer = document.getElementById("player") as HTMLElement;
const controls = document.getElementById("controls") as HTMLElement;
const status = document.getElementById("status") as HTMLElement;

let handle: TLottiePlayerHandle = createTLottiePlayer(playerContainer, {
	src: assetUrl("sample.json"),
	outline,
	loop: true,
	autoplay: true,
});
const controlsHandle = attachControls(controls, status, handle.tlottie);

// Destroys the previous player before creating the next one, instead of
// leaving it running and appending a second instance next to it — every
// "load" button reuses the same canvas/control panel.
function load(src: string): void {
	handle.destroy();
	handle = createTLottiePlayer(playerContainer, {
		src,
		outline,
		loop: true,
		autoplay: true,
	});
	controlsHandle.rebind(handle.tlottie);
}

document
	.getElementById("load-tgs")
	?.addEventListener("click", () => load(assetUrl("sample.tgs")));
document
	.getElementById("load-error")
	?.addEventListener("click", () => load(assetUrl("does-not-exist.json")));
