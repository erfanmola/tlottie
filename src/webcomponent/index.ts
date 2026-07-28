import "../style/shimmer.scss";
import {
	registerTLottiePlayerElement,
	TLottiePlayerElement,
} from "./tlottie-player.ts";

export * from "../core/types.ts";
export { registerTLottiePlayerElement, TLottiePlayerElement };

// Importing this module registers <tlottie-player> globally, matching how
// every other custom-element library behaves — consumers who want manual
// control over the tag name can skip this default and call
// registerTLottiePlayerElement("my-tag-name") themselves instead.
registerTLottiePlayerElement();
