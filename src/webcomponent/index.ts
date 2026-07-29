import "../style/shimmer.scss";
import { initializeTLottie } from "../main/initialize.ts";
import { configureTLottie, TLottie } from "../main/TLottie.ts";
import {
	registerTLottiePlayerElement,
	TLottiePlayerElement,
} from "./tlottie-player.ts";

export * from "../core/types.ts";
export type { InitializeTLottieOptions } from "../main/initialize.ts";
export {
	configureTLottie,
	initializeTLottie,
	registerTLottiePlayerElement,
	TLottie,
	TLottiePlayerElement,
};

// Importing this module registers <tlottie-player> globally, matching how
// every other custom-element library behaves — consumers who want manual
// control over the tag name can skip this default and call
// registerTLottiePlayerElement("my-tag-name") themselves instead.
registerTLottiePlayerElement();
