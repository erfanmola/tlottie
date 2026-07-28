import {
	registerTLottiePlayerElement,
	type TLottiePlayerElement,
} from "../../src/webcomponent/tlottie-player.ts";
import { assetUrl } from "../asset-url.ts";
import outline from "../assets/outline.svg?raw";
import { attachControls } from "../shared.ts";

const player = document.getElementById("player") as TLottiePlayerElement;
player.setAttribute("src", assetUrl("sample.json"));
// Passing an SVG string through an HTML attribute needs escaping the demo
// doesn't bother with — set it as a property instead, same as any other
// framework binding would.
player.setAttribute("outline", outline);

// Calling this explicitly (rather than relying on the bare `import
// "../../src/webcomponent/index.ts"` side effect the package normally
// uses) is deliberate: the package's `sideEffects` allowlist in
// package.json only covers `./dist/webcomponent/*.js` (what published
// consumers get after `import "tlottie/webcomponent"`), not
// `src/webcomponent/*.ts` — a same-repo import straight from src/, like
// this demo does, has its registration side effect tree-shaken away in a
// production build otherwise. Real bug, only caught by actually building
// and running the demo, not by typecheck or the dev server.
registerTLottiePlayerElement();

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
