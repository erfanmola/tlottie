import type { TLottieWasmExports } from "./wasm.ts";

export interface WasmAlloc {
	ptr: number;
	len: number;
}

/**
 * Allocates `bytes.length` bytes in wasm memory and copies `bytes` in.
 * Returns null on allocation failure (OOM or zero length).
 *
 * The memory view is always freshly derived from the current
 * `exports.memory.buffer` right before the copy — never cache a view across
 * an `tlottie_alloc`/`tlottie_*` call, since memory growth detaches prior
 * `ArrayBuffer`s.
 */
export function writeBytes(
	exports: TLottieWasmExports,
	bytes: Uint8Array,
): WasmAlloc | null {
	const len = bytes.length;
	if (len === 0) return null;
	const ptr = exports.tlottie_alloc(len);
	if (ptr === 0) return null;
	new Uint8Array(exports.memory.buffer, ptr, len).set(bytes);
	return { ptr, len };
}

export function freeBytes(exports: TLottieWasmExports, alloc: WasmAlloc): void {
	if (alloc.ptr !== 0) exports.tlottie_free(alloc.ptr, alloc.len);
}

/** Freshly derives a view over an instance-owned RGBA8 render target. Do not retain past the next render call. */
export function readRgba(
	exports: TLottieWasmExports,
	ptr: number,
	width: number,
	height: number,
): Uint8ClampedArray<ArrayBuffer> {
	return new Uint8ClampedArray(exports.memory.buffer, ptr, width * height * 4);
}

/** Freshly derives a view over an instance-owned Alpha8 render target. Do not retain past the next render call. */
export function readAlpha8(
	exports: TLottieWasmExports,
	ptr: number,
	width: number,
	height: number,
): Uint8Array<ArrayBuffer> {
	return new Uint8Array(exports.memory.buffer, ptr, width * height);
}
