import "../style/shimmer.scss";
import { buildShimmerMaskStyle } from "../main/shimmer.ts";
import {
	configureTLottie,
	TLottie,
	type TLottieConfig,
	type TLottieListener,
} from "../main/TLottie.ts";

export * from "../core/types.ts";
export type { TLottieConfig };
export { configureTLottie, TLottie };

export interface CreateTLottiePlayerOptions
	extends Omit<TLottieConfig, "canvas"> {
	/** Raw SVG string used as a loading/error skeleton via CSS mask-image. */
	outline?: string;
	className?: string;
}

export interface TLottiePlayerHandle {
	readonly tlottie: TLottie;
	readonly element: HTMLDivElement;
	readonly canvas: HTMLCanvasElement;
	destroy(): void;
}

/** Builds a canvas + optional shimmer skeleton inside `container` and wires up a TLottie player. */
export function createTLottiePlayer(
	container: HTMLElement,
	options: CreateTLottiePlayerOptions,
): TLottiePlayerHandle {
	const { outline, className, ...config } = options;

	const wrapper = document.createElement("div");
	wrapper.className = className
		? `tlottie-player ${className}`
		: "tlottie-player";

	const canvas = document.createElement("canvas");
	wrapper.appendChild(canvas);

	let shimmer: HTMLDivElement | null = null;
	if (outline) {
		shimmer = document.createElement("div");
		shimmer.className = "tlottie-shimmer";
		const style = buildShimmerMaskStyle(outline);
		shimmer.style.setProperty("mask-image", style.maskImage);
		shimmer.style.setProperty("-webkit-mask-image", style.WebkitMaskImage);
		wrapper.appendChild(shimmer);
	}

	container.appendChild(wrapper);

	const tlottie = new TLottie({ ...config, canvas });

	const onLoad: TLottieListener = () => {
		canvas.classList.add("tlottie-ready");
		shimmer?.classList.add("tlottie-hidden");
	};
	const onError: TLottieListener = () => {
		canvas.classList.remove("tlottie-ready");
		shimmer?.classList.remove("tlottie-hidden");
	};
	tlottie.on("load", onLoad);
	tlottie.on("error", onError);

	return {
		tlottie,
		element: wrapper,
		canvas,
		destroy(): void {
			tlottie.off("load", onLoad);
			tlottie.off("error", onError);
			tlottie.destroy();
			wrapper.remove();
		},
	};
}
