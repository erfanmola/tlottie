import {
	configureTLottie,
	createTLottiePlayer,
} from "../../src/vanilla/index.ts";
import outline from "../assets/outline.svg?raw";
import { attachControls } from "../shared.ts";

configureTLottie({ workerCount: 2 });

const playerContainer = document.getElementById("player") as HTMLElement;
const controls = document.getElementById("controls") as HTMLElement;
const status = document.getElementById("status") as HTMLElement;

const handle = createTLottiePlayer(playerContainer, {
	src: "/assets/sample.json",
	outline,
	loop: true,
	autoplay: true,
});

attachControls(controls, status, handle.tlottie);

document.getElementById("load-tgs")?.addEventListener("click", () => {
	const tgsHandle = createTLottiePlayer(
		playerContainer.parentElement as HTMLElement,
		{
			src: "/assets/sample.tgs",
			outline,
			loop: true,
			autoplay: true,
		},
	);
	tgsHandle.tlottie.on("load", () => {
		status.textContent = `.tgs decoded and loaded ok\n${status.textContent}`;
	});
});

document.getElementById("load-error")?.addEventListener("click", () => {
	const errorHandle = createTLottiePlayer(
		playerContainer.parentElement as HTMLElement,
		{
			src: "/assets/does-not-exist.json",
			outline,
			autoplay: true,
		},
	);
	errorHandle.tlottie.on("error", (p) => {
		status.textContent = `error demo: ${p.error?.reason} — ${p.error?.message}\n${status.textContent}`;
	});
});
