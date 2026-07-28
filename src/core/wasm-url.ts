// Deliberately NOT `new URL("./tlottie.wasm", import.meta.url)` written
// inline: that exact pattern is what Vite's bundled-asset detector scans
// for, and in library mode it responds by base64-inlining the whole ~480KB
// binary into every bundle that imports this module (it can't know where a
// consumer will place the built file, so it can't safely emit a relative
// reference). Routing `import.meta.url` through a variable first evades
// that detection, so this stays an ordinary runtime URL computation.
//
// The relative path differs between dev and build: in dev the demo imports
// this module straight from src/core/, where tlottie.wasm sits alongside
// it; in a production build, every target's index.js ends up one level
// down (dist/<target>/index.js), and copyWasmPlugin (vite.shared.ts)
// writes a single shared copy to dist/tlottie.wasm instead of duplicating
// the ~480KB binary into all 7 targets. import.meta.env.DEV is statically
// known at build time, so the unused branch is dead-code-eliminated.
const moduleUrl: string = import.meta.url;
export const DEFAULT_WASM_URL: URL = import.meta.env.DEV
	? new URL("./tlottie.wasm", moduleUrl)
	: new URL("../tlottie.wasm", moduleUrl);
