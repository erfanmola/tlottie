import { type HTMLAttributes, useEffect, useRef, useState } from "react";
import "../style/shimmer.scss";
import { buildShimmerMaskStyle } from "../main/shimmer.ts";
import {
	TLottie,
	type TLottieConfig,
	type TLottieEventPayload,
} from "../main/TLottie.ts";

export interface LottiePlayerProps
	extends Omit<TLottieConfig, "canvas">,
		Omit<HTMLAttributes<HTMLDivElement>, "onLoad" | "onError"> {
	/** Raw SVG string used as a loading/error skeleton via CSS mask-image. */
	outline?: string;
	onLoad?: (payload: TLottieEventPayload) => void;
	onError?: (payload: TLottieEventPayload) => void;
	onComplete?: (payload: TLottieEventPayload) => void;
	lottieRefCallback?: (tlottie: TLottie | null) => void;
}

export function LottiePlayer(props: LottiePlayerProps) {
	const {
		src,
		data,
		speed,
		loop,
		direction,
		autoplay,
		fitzModifier,
		layerColorReplacements,
		quality,
		workerCount,
		pool,
		forceRender,
		reportFrames,
		wasmUrl,
		outline,
		onLoad,
		onError,
		onComplete,
		lottieRefCallback,
		className,
		...rest
	} = props;

	const canvasRef = useRef<HTMLCanvasElement>(null);
	const tlottieRef = useRef<TLottie | null>(null);
	const [loaded, setLoaded] = useState(false);
	const [errored, setErrored] = useState(false);

	// Only src/data identity changes tear down and re-fetch/re-parse the
	// animation; playback tweaks below are applied live to the running
	// instance instead, since they're cheap and shouldn't restart playback.
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		setLoaded(false);
		setErrored(false);

		const tlottie = new TLottie({
			canvas,
			src,
			data,
			speed,
			loop,
			direction,
			autoplay,
			fitzModifier,
			layerColorReplacements,
			quality,
			workerCount,
			pool,
			forceRender,
			reportFrames,
			wasmUrl,
		});
		tlottieRef.current = tlottie;
		lottieRefCallback?.(tlottie);

		const handleLoad = (payload: TLottieEventPayload) => {
			setLoaded(true);
			setErrored(false);
			onLoad?.(payload);
		};
		const handleError = (payload: TLottieEventPayload) => {
			setErrored(true);
			onError?.(payload);
		};
		const handleComplete = (payload: TLottieEventPayload) =>
			onComplete?.(payload);
		tlottie.on("load", handleLoad);
		tlottie.on("error", handleError);
		tlottie.on("complete", handleComplete);

		return () => {
			tlottie.off("load", handleLoad);
			tlottie.off("error", handleError);
			tlottie.off("complete", handleComplete);
			tlottieRef.current = null;
			lottieRefCallback?.(null);
			tlottie.destroy();
		};
	}, [src, data]);

	useEffect(() => {
		if (speed !== undefined) tlottieRef.current?.setSpeed(speed);
	}, [speed]);
	useEffect(() => {
		if (loop !== undefined) tlottieRef.current?.setLoop(loop);
	}, [loop]);
	useEffect(() => {
		if (direction !== undefined) tlottieRef.current?.setDirection(direction);
	}, [direction]);
	useEffect(() => {
		if (fitzModifier !== undefined)
			tlottieRef.current?.setFitzModifier(fitzModifier);
	}, [fitzModifier]);

	const shimmerStyle = outline ? buildShimmerMaskStyle(outline) : null;

	return (
		<div
			className={className ? `tlottie-player ${className}` : "tlottie-player"}
			{...rest}
		>
			<canvas
				// transferControlToOffscreen() can only run once per canvas
				// element ever — keying on source identity forces React to
				// mount a fresh <canvas> instead of reusing the old
				// (already-transferred) one when src/data changes.
				key={reactKeyForSource(src, data)}
				ref={canvasRef}
				className={loaded ? "tlottie-ready" : undefined}
			/>
			{outline ? (
				<div
					className={
						!loaded || errored
							? "tlottie-shimmer"
							: "tlottie-shimmer tlottie-hidden"
					}
					style={{
						maskImage: shimmerStyle?.maskImage,
						WebkitMaskImage: shimmerStyle?.WebkitMaskImage,
					}}
				/>
			) : null}
		</div>
	);
}

function reactKeyForSource(
	src: string | undefined,
	data: string | Uint8Array | undefined,
): string {
	if (src !== undefined) return `src:${src}`;
	if (typeof data === "string") return `data:${data}`;
	return data !== undefined ? "data:binary" : "empty";
}
