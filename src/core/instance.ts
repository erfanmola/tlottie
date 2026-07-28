import {
	freeBytes,
	readAlpha8,
	readRgba,
	type WasmAlloc,
	writeBytes,
} from "./memory.ts";
import {
	DEFAULT_RENDER_QUALITY,
	FitzModifier,
	type LayerColorReplacementInput,
	type RenderQuality,
} from "./types.ts";
import type { TLottieWasmExports } from "./wasm.ts";

// #[repr(C)] LayerColorReplacementAbi in tlottie/src/bindings/wasm.rs: on
// wasm32 every field is 4 bytes (pointer, usize, u32) => 12-byte stride.
const REPLACEMENT_STRUCT_SIZE = 12;

export interface CreateInstanceOptions {
	fitzModifier?: FitzModifier;
	layerColorReplacements?: LayerColorReplacementInput[];
}

/**
 * Wraps a `tlottie_new*` pointer. Every render call returns a view into a
 * buffer owned (and reused) by this instance — never hold onto a returned
 * view past the next render/drop call.
 */
export class TLottieInstance {
	private ptr: number;
	readonly width: number;
	readonly height: number;
	readonly frameRate: number;
	readonly frameCount: number;

	private readonly exports: TLottieWasmExports;

	private constructor(exports: TLottieWasmExports, ptr: number) {
		this.exports = exports;
		this.ptr = ptr;
		this.width = exports.tlottie_width(ptr);
		this.height = exports.tlottie_height(ptr);
		this.frameRate = exports.tlottie_frame_rate(ptr);
		this.frameCount = Math.max(1, exports.tlottie_frame_count(ptr));
	}

	static create(
		exports: TLottieWasmExports,
		json: Uint8Array,
		options?: CreateInstanceOptions,
	): TLottieInstance | null {
		const jsonAlloc = writeBytes(exports, json);
		if (!jsonAlloc) return null;

		const packed = packReplacements(
			exports,
			options?.layerColorReplacements ?? [],
		);
		if (!packed) {
			freeBytes(exports, jsonAlloc);
			return null;
		}

		const ptr = exports.tlottie_new_with_options(
			jsonAlloc.ptr,
			jsonAlloc.len,
			options?.fitzModifier ?? FitzModifier.None,
			packed.arrayPtr,
			packed.arrayLen,
		);

		freeBytes(exports, jsonAlloc);
		for (const prefixAlloc of packed.prefixAllocs)
			freeBytes(exports, prefixAlloc);
		if (packed.arrayLen > 0)
			freeBytes(exports, {
				ptr: packed.arrayPtr,
				len: packed.arrayLen * REPLACEMENT_STRUCT_SIZE,
			});

		if (ptr === 0) return null;
		return new TLottieInstance(exports, ptr);
	}

	render(
		frame: number,
		width: number,
		height: number,
		quality: RenderQuality = DEFAULT_RENDER_QUALITY,
	): Uint8ClampedArray<ArrayBuffer> | null {
		const ptr = this.exports.tlottie_render_with_options(
			this.ptr,
			frame,
			width,
			height,
			quality.antialias ? 1 : 0,
			quality.curveTolerance,
		);
		if (ptr === 0) return null;
		return readRgba(this.exports, ptr, width, height);
	}

	renderAlpha8(
		frame: number,
		width: number,
		height: number,
		quality: RenderQuality = DEFAULT_RENDER_QUALITY,
	): Uint8Array<ArrayBuffer> | null {
		const ptr = this.exports.tlottie_render_alpha8_with_options(
			this.ptr,
			frame,
			width,
			height,
			quality.antialias ? 1 : 0,
			quality.curveTolerance,
		);
		if (ptr === 0) return null;
		return readAlpha8(this.exports, ptr, width, height);
	}

	/** Renders the alpha mask expanded to a solid straight-alpha RGBA8 tint (0x00RRGGBB). */
	renderAlpha8Color(
		frame: number,
		width: number,
		height: number,
		color: number,
		quality: RenderQuality = DEFAULT_RENDER_QUALITY,
	): Uint8ClampedArray<ArrayBuffer> | null {
		const ptr = this.exports.tlottie_render_alpha8_color_with_options(
			this.ptr,
			frame,
			width,
			height,
			quality.antialias ? 1 : 0,
			color >>> 0,
			quality.curveTolerance,
		);
		if (ptr === 0) return null;
		return readRgba(this.exports, ptr, width, height);
	}

	drop(): void {
		if (this.ptr !== 0) {
			this.exports.tlottie_drop(this.ptr);
			this.ptr = 0;
		}
	}
}

interface PackedReplacements {
	arrayPtr: number;
	arrayLen: number;
	prefixAllocs: WasmAlloc[];
}

function packReplacements(
	exports: TLottieWasmExports,
	replacements: LayerColorReplacementInput[],
): PackedReplacements | null {
	if (replacements.length === 0)
		return { arrayPtr: 0, arrayLen: 0, prefixAllocs: [] };

	const structBytes = replacements.length * REPLACEMENT_STRUCT_SIZE;
	const arrayPtr = exports.tlottie_alloc(structBytes);
	if (arrayPtr === 0) return null;

	const encoder = new TextEncoder();
	const prefixAllocs: WasmAlloc[] = [];
	for (let i = 0; i < replacements.length; i++) {
		const prefixAlloc = writeBytes(
			exports,
			encoder.encode(replacements[i].layerNamePrefix),
		);
		// An empty prefix is valid (matches every layer) but writeBytes()
		// returns null for zero-length input — use a null pointer + zero len,
		// which the Rust side treats identically to an allocated empty slice.
		const ptr = prefixAlloc?.ptr ?? 0;
		const len = prefixAlloc?.len ?? 0;
		if (prefixAlloc) prefixAllocs.push(prefixAlloc);

		// Re-derive the DataView after every writeBytes() call above: that
		// call may have grown memory and detached any prior view, including
		// one over this very struct array.
		const view = new DataView(exports.memory.buffer, arrayPtr, structBytes);
		view.setUint32(i * REPLACEMENT_STRUCT_SIZE, ptr, true);
		view.setUint32(i * REPLACEMENT_STRUCT_SIZE + 4, len, true);
		view.setUint32(
			i * REPLACEMENT_STRUCT_SIZE + 8,
			replacements[i].color >>> 0,
			true,
		);
	}

	return { arrayPtr, arrayLen: replacements.length, prefixAllocs };
}
