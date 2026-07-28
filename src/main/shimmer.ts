export interface ShimmerMaskStyle {
	maskImage: string;
	WebkitMaskImage: string;
}

/** Builds a CSS mask-image style from a raw outline SVG string, for the loading/error shimmer. */
export function buildShimmerMaskStyle(outlineSvg: string): ShimmerMaskStyle {
	const dataUri = `url("data:image/svg+xml;base64,${svgToBase64(outlineSvg)}")`;
	return { maskImage: dataUri, WebkitMaskImage: dataUri };
}

// btoa() only accepts Latin1; encode through UTF-8 bytes first so outline
// SVGs with non-ASCII content (e.g. a title) don't throw.
function svgToBase64(svg: string): string {
	const bytes = new TextEncoder().encode(svg);
	let binary = "";
	for (let i = 0; i < bytes.length; i++)
		binary += String.fromCharCode(bytes[i]);
	return btoa(binary);
}
