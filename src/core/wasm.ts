/**
 * Raw exports of tlottie.wasm (tlottie/src/bindings/wasm.rs) — a
 * wasm32-unknown-unknown build with no JS glue. Every pointer is a byte
 * offset into `memory.buffer`; every buffer returned by a render call is
 * owned by the instance and overwritten by the instance's next render call.
 */
export interface TLottieWasmExports {
	memory: WebAssembly.Memory;
	tlottie_alloc(len: number): number;
	tlottie_free(ptr: number, len: number): void;
	tlottie_new(jsonPtr: number, jsonLen: number): number;
	tlottie_new_with_options(
		jsonPtr: number,
		jsonLen: number,
		fitzModifier: number,
		replacementsPtr: number,
		replacementsLen: number,
	): number;
	tlottie_drop(inst: number): void;
	tlottie_width(inst: number): number;
	tlottie_height(inst: number): number;
	tlottie_frame_rate(inst: number): number;
	tlottie_frame_count(inst: number): number;
	tlottie_render(
		inst: number,
		frame: number,
		width: number,
		height: number,
		antialias: number,
	): number;
	tlottie_render_with_options(
		inst: number,
		frame: number,
		width: number,
		height: number,
		antialias: number,
		curveTolerance: number,
	): number;
	tlottie_render_alpha8(
		inst: number,
		frame: number,
		width: number,
		height: number,
		antialias: number,
	): number;
	tlottie_render_alpha8_with_options(
		inst: number,
		frame: number,
		width: number,
		height: number,
		antialias: number,
		curveTolerance: number,
	): number;
	tlottie_render_alpha8_color(
		inst: number,
		frame: number,
		width: number,
		height: number,
		antialias: number,
		color: number,
	): number;
	tlottie_render_alpha8_color_with_options(
		inst: number,
		frame: number,
		width: number,
		height: number,
		antialias: number,
		color: number,
		curveTolerance: number,
	): number;
}

// Module-scoped singleton: each Worker/window gets its own global scope, so
// this memoizes the one wasm instantiation per worker (matches the pattern
// of reusing a single compiled module across every animation instance
// routed to that worker, instead of re-instantiating wasm per-animation).
let modulePromise: Promise<TLottieWasmExports> | null = null;

export function loadWasmModule(
	wasmUrl: string | URL,
): Promise<TLottieWasmExports> {
	if (!modulePromise) {
		modulePromise = instantiate(wasmUrl);
	}
	return modulePromise;
}

async function instantiate(wasmUrl: string | URL): Promise<TLottieWasmExports> {
	// tlottie.wasm is a stable, versioned build artifact — force-cache skips
	// revalidation roundtrips on repeat loads, same as the animation fetch
	// cache in main/cache.ts.
	if (typeof WebAssembly.instantiateStreaming === "function") {
		try {
			const { instance } = await WebAssembly.instantiateStreaming(
				fetch(wasmUrl, { cache: "force-cache" }),
				{},
			);
			return instance.exports as unknown as TLottieWasmExports;
		} catch {
			// Falls through to arrayBuffer instantiation — instantiateStreaming
			// requires the server to send application/wasm; some dev servers
			// or file:// contexts don't.
		}
	}
	const bytes = await (
		await fetch(wasmUrl, { cache: "force-cache" })
	).arrayBuffer();
	const { instance } = await WebAssembly.instantiate(bytes, {});
	return instance.exports as unknown as TLottieWasmExports;
}
