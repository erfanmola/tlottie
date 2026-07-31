/**
 * Resolved once, here, on the main thread — never inside the worker chunk
 * itself. A worker chunk that computes its own `import.meta.url`-relative
 * default gets re-bundled a second time by a consuming app's own Vite build
 * (since `new Worker(new URL('./worker.js', import.meta.url))` makes that
 * chunk a fresh worker *entry* from the consumer's point of view), and that
 * second bundling pass double-processes any `import.meta.url` reference
 * already inside it, producing a URL that resolves to nothing. This
 * module's `new URL(..., import.meta.url)` only ever goes through Vite's
 * asset pipeline once — as an ordinary main-thread reference — so it
 * survives being re-bundled downstream the same way the worker's own
 * `new Worker(new URL(...))` call already does. Every call site that talks
 * to a worker passes this down explicitly instead of letting the worker
 * guess its own default.
 *
 * `?no-inline` matters too: every one of this package's build targets is a
 * library build, and Vite/Rolldown unconditionally base64-inlines assets
 * referenced from a library build regardless of `assetsInlineLimit` —
 * without it this ~418KB wasm binary would get inlined as a data URI
 * wherever this constant is bundled.
 */
export const DEFAULT_WASM_URL: URL = new URL(
	"../core/tlottie.wasm?no-inline",
	import.meta.url,
);
