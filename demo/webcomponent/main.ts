import outline from "../assets/outline.svg?raw";
import "../../src/webcomponent/index.ts";
import type { TLottiePlayerElement } from "../../src/webcomponent/tlottie-player.ts";
import { attachControls } from "../shared.ts";

const player = document.getElementById("player") as TLottiePlayerElement;
// Passing an SVG string through an HTML attribute needs escaping the demo
// doesn't bother with — set it as a property instead, same as any other
// framework binding would.
player.setAttribute("outline", outline);

const controls = document.getElementById("controls") as HTMLElement;
const status = document.getElementById("status") as HTMLElement;

function bind(): void {
	const tlottie = player.tlottie;
	if (!tlottie) {
		requestAnimationFrame(bind);
		return;
	}
	attachControls(controls, status, tlottie);
}
bind();
