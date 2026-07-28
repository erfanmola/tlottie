const GZIP_MAGIC_0 = 0x1f;
const GZIP_MAGIC_1 = 0x8b;

/** `.tgs` files (Telegram sticker Lottie) are plain Lottie JSON gzipped — detect by magic bytes. */
export function isGzip(bytes: Uint8Array): boolean {
	return (
		bytes.length >= 2 && bytes[0] === GZIP_MAGIC_0 && bytes[1] === GZIP_MAGIC_1
	);
}

/** Decompresses gzip bytes using the browser-native streaming API — no gzip dependency needed. */
export async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
	if (typeof DecompressionStream === "undefined") {
		throw new Error(
			"tlottie: gzip (.tgs) decompression requires DecompressionStream, which is unavailable in this environment",
		);
	}
	const stream = new Blob([bytes as BlobPart])
		.stream()
		.pipeThrough(new DecompressionStream("gzip"));
	const buffer = await new Response(stream).arrayBuffer();
	return new Uint8Array(buffer);
}

/** Decompresses `bytes` if gzipped, otherwise returns them unchanged. */
export async function decodeAnimationBytes(
	bytes: Uint8Array,
): Promise<Uint8Array> {
	return isGzip(bytes) ? gunzip(bytes) : bytes;
}
