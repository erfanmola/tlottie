# tlottie

[![npm version](https://img.shields.io/npm/v/tlottie.svg)](https://www.npmjs.com/package/tlottie)
[![license](https://img.shields.io/npm/l/tlottie.svg)](./LICENSE)

Fast, Web Worker–based [Lottie](https://airbnb.io/lottie/) and TGS (Telegram sticker) renderer, backed by the [tlottie](https://github.com/dkaraush/tlottie) Rust/WASM engine. Ships adapters for **React**, **SolidJS**, **Vue**, **Svelte**, **Web Components**, and **Vanilla JS**.

**[Live demo →](https://erfanmola.github.io/tlottie/)** — one page per adapter.

- **Off the main thread.** Parsing and rendering happen in a configurable pool of Web Workers, drawing into an `OffscreenCanvas` — no jank on the UI thread.
- **Fast core.** The underlying [tlottie](https://github.com/dkaraush/tlottie) engine benchmarks 23–73% faster frame times than rlottie/thorvg (see its own README for numbers).
- **TGS support.** Gzipped Lottie (`.tgs`, Telegram stickers) is decompressed in-worker using the browser-native `DecompressionStream` — no `pako`/`fflate` dependency.
- **Skeleton loading.** Pass an outline SVG and get a CSS `mask-image` shimmer while the animation loads or if it fails — generate that SVG with the bundled `tlottie-outline` CLI (`bunx tlottie-outline --input animation.json`).
- **Small.** Adapters add ~0.6–1.4KB gzipped on top of the ~3KB shared core. The WASM binary (~534KB raw, ~166KB brotli / ~211KB gzip) is fetched lazily and reused within each worker. All adapters share one core runtime and browser WASM asset.

## Install

```sh
bun add tlottie
# or: npm install tlottie / pnpm add tlottie / yarn add tlottie
```

Framework peer dependencies (`react`, `solid-js`, `vue`, `svelte`) are optional — only install the one matching the adapter you use.
The Svelte adapter requires **Svelte 5**; its compiled runtime is incompatible with Svelte 4.

For Vite projects, read the [Vite configuration](#vite-configuration) below before starting the dev server.

## Quick start

### React

```tsx
import { LottiePlayer } from "tlottie/react";
import "tlottie/react/style.css";

<LottiePlayer src="/animation.json" loop autoplay />;
```

### SolidJS

```tsx
import { LottiePlayer } from "tlottie/solid";
import "tlottie/solid/style.css";

<LottiePlayer src="/animation.json" loop autoplay />;
```

### Vue

```vue
<script setup>
import { LottiePlayer } from "tlottie/vue";
import "tlottie/vue/style.css";
</script>

<template>
	<LottiePlayer src="/animation.json" loop autoplay />
</template>
```

### Svelte

```svelte
<script>
	import { LottiePlayer } from "tlottie/svelte";
	import "tlottie/svelte/style.css";
</script>

<LottiePlayer src="/animation.json" loop autoplay />
```

### Web Component

```js
import "tlottie/webcomponent";
import "tlottie/webcomponent/style.css";
```

```html
<tlottie-player src="/animation.json" loop autoplay></tlottie-player>
```

### Vanilla JS

```js
import { createTLottiePlayer } from "tlottie/vanilla";
import "tlottie/vanilla/style.css";

const { tlottie, destroy } = createTLottiePlayer(document.getElementById("app"), {
	src: "/animation.json",
	loop: true,
	autoplay: true,
});
```

Import the adapter stylesheet for canvas positioning, visibility, and the optional shimmer. Give the player an explicit width and height; its absolutely positioned canvas does not size the wrapper:

```css
.tlottie-player {
	width: 256px;
	height: 256px;
}
```

For Web Components, also size the `<tlottie-player>` host (`display: block; width: 256px; height: 256px`). The core `TLottie` API takes your own canvas and does not need an adapter stylesheet.

Stylesheet paths:

```js
import "tlottie/react/style.css"; // or /solid, /vue, /svelte, /vanilla, /webcomponent
```

### Vite configuration

Add `tlottie` to `optimizeDeps.exclude` while keeping your framework's usual plugins:

```ts
import { defineConfig } from "vite";

export default defineConfig({
	// plugins: [react()], [vue()], [solid()], or [svelte()]
	optimizeDeps: { exclude: ["tlottie"] },
});
```

This covers `tlottie` and its adapter subpaths. Do not put them in `optimizeDeps.include`. Vite 6/7 prebundling moves the package's relative worker/WASM URLs into `node_modules/.vite/deps`, causing a worker 404 and a blank player. Vite 8.3.4 passed our default-config tests, but excluding the package is the compatible setup across these versions. Production bundling works without the exclusion. See Vite's [dependency optimization options](https://vite.dev/config/dep-optimization-options) and [worker URL issue](https://github.com/vitejs/vite/issues/20859).

After changing the configuration or upgrading tlottie, restart with `vite --force` (or remove `node_modules/.vite`) to clear old optimized entries.

The default worker and WASM assets are bundled automatically; no Rust toolchain, manual copy, or WASM plugin is needed. Deploy the entire app build output, including `assets/`. Nested Vite `base` paths are supported and tested. Mount players on the client in SSR applications; rendering requires browser APIs.

### WASM troubleshooting and custom hosting

If the player stays blank, check its dimensions and stylesheet first, then inspect the worker and `.wasm` requests in DevTools. A URL under `.vite/deps/assets/` indicates the optimization issue above. A WASM URL returning HTML usually indicates a missing deployed asset or an SPA fallback route. Serve the binary with `Content-Type: application/wasm`; the loader also supports other MIME types by falling back to buffered instantiation without downloading it twice. Failed WASM loads can be retried by creating a new player or calling `initializeTLottie()` again.

To host the binary yourself, use the same installed package version's exported asset:

```ts
import wasmUrl from "tlottie/wasm?url&no-inline"; // Vite URL import
import { initializeTLottie } from "tlottie";

await initializeTLottie({ wasmUrl });
// Also pass wasmUrl to each player using this custom binary:
// <LottiePlayer src="/animation.json" wasmUrl={wasmUrl} />
```

Alternatively copy `node_modules/tlottie/dist/tlottie.wasm` to your public directory and pass its served URL. Relative overrides are resolved against the page's `document.baseURI`, including a `<base>` element, before being sent to the worker. Cross-origin animation/WASM hosts must allow CORS. If your site uses CSP, allow the worker origin in `worker-src`, animation/WASM hosts in `connect-src`, and WebAssembly compilation through `script-src 'wasm-unsafe-eval'` where your browser requires it.

See [consumer testing](./docs/consumer-testing.md) for the tested configurations and reproduction commands.

## Loading data

```tsx
<LottiePlayer src="https://example.com/animation.json" />
<LottiePlayer src="https://example.com/sticker.tgs" />       {/* gzipped, decompressed automatically */}
<LottiePlayer data={jsonString} />                            {/* raw Lottie JSON string */}
<LottiePlayer data={uint8ArrayBytes} />                        {/* raw bytes, plain or gzipped */}
```

`src` fetches are cached in-memory per URL and shared across every player instance on the page — loading the same animation twice never re-fetches.

## Skeleton / shimmer loading state

Pass a silhouette SVG (as a raw string) via `outline`; it's rendered as a CSS `mask-image` behind the canvas until the animation loads (or shown again if it errors):

```tsx
<LottiePlayer src="/animation.json" outline={outlineSvgString} />
```

Generate that outline SVG from a Lottie/`.tgs` file with the bundled `tlottie-outline` CLI — no separate install, works via `bunx`/`npx`, or as an `npm run` script in any project that has `tlottie` installed:

```sh
bunx tlottie-outline --input animation.json
# or: npx tlottie-outline --input animation.json
# writes animation-outline.svg next to it
```

```
Usage: tlottie-outline --input <file.json|file.tgs> [--output <file.svg>] [--frame <n>] [--size <px>]

  -i, --input   Path to a Lottie JSON or .tgs (gzipped) file. Required.
  -o, --output  Path to write the outline SVG. Defaults to <input-without-extension>-outline.svg.
  -f, --frame   Frame number to trace. Defaults to 0.
  -s, --size    Raster size (px, square) used for tracing — higher is more accurate and slower. Defaults to 512.
```

It renders the given frame with tlottie's own wasm renderer (same one the library uses), flattens every visible pixel to a black silhouette, and traces that into an optimized SVG path — the same technique, reimplemented, as [erfanmola/lottie-output-generator](https://github.com/erfanmola/lottie-output-generator) but built on tlottie/wasm instead of thorvg, so it shares this package's gzip decoding and renderer instead of needing its own.

## Playback control

Every adapter exposes the underlying `TLottie` instance (via `lottieRefCallback` in React/Solid/Svelte, `ref`+`defineExpose` in Vue, or the `.tlottie` property on the custom element / vanilla handle):

```ts
tlottie.play();
tlottie.pause();
tlottie.stop();
tlottie.seek(30);
tlottie.setSpeed(1.5);
tlottie.setLoop(true); // or a number of loop repetitions, or false
tlottie.setDirection(-1); // 1 | -1
tlottie.on("load" | "play" | "pause" | "stop" | "frame" | "loopComplete" | "complete" | "error", (payload) => {});
```

`speed`/`loop`/`direction`/`fitzModifier` props are applied live to the running instance when changed; changing `src`/`data` remounts the canvas and reloads.

## Configuration

| Prop               | Type                                       | Notes                                                                                     |
| ------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src` / `data`      | `string` / `string \| Uint8Array`           | One is required.                                                                             |
| `speed`             | `number`                                    | Default `1`.                                                                                 |
| `loop`              | `boolean \| number`                         | `true` = forever, `number` = play that many times.                                           |
| `direction`         | `1 \| -1`                                   |                                                                                               |
| `autoplay`          | `boolean`                                   | Default `true`.                                                                              |
| `fitzModifier`      | `FitzModifier`                              | Telegram Fitzpatrick skin-tone variant. Parse-time only — changing it recreates the instance. |
| `layerColorReplacements` | `{ layerNamePrefix, color }[]`          | Recolors layers by name prefix. Parse-time only.                                             |
| `quality`           | `{ antialias?, curveTolerance? }`           | Render quality knobs.                                                                        |
| `pool`              | `TLottieWorkerPool`                         | Optional caller-owned pool shared across a group of players. |
| `forceRender`       | `boolean`                                   | Keep rendering while off-screen (skips the IntersectionObserver auto-pause).                 |
| `reportFrames`      | `boolean`                                   | Emit throttled (~10Hz) `frame` events, for progress UIs. Off by default (costs a `postMessage` per emission). |
| `playOnClick`       | `boolean`                                   | Clicking the canvas calls `play()`. Mainly for non-looping animations: they play once, then replay on each click. |

### Worker pool

By default all players share a single worker (one worker already multiplexes any number of animations fine — each worker owns its own WASM module instance, so sizing the default off `navigator.hardwareConcurrency` just burns memory on typical multi-core machines for no benefit). Raise it if you've profiled a worker-bound workload:

```ts
import { configureTLottie } from "tlottie";

configureTLottie({ workerCount: 4 });
```

Each player uses exactly one worker; a larger pool distributes separate players across workers. All adapters and imports from `tlottie` share the same default pool.

For an isolated group, create a pool once and pass the same `pool` to its players and initialization:

```tsx
import { TLottieWorkerPool, initializeTLottie } from "tlottie";
import { LottiePlayer } from "tlottie/react";

const pool = new TLottieWorkerPool(2);
await initializeTLottie({ pool });
// <LottiePlayer src="/first.json" pool={pool} />
// <LottiePlayer src="/second.json" pool={pool} />
```

Pools belong to the application. Destroying one player removes its animation while keeping the shared worker available to other players. After destroying every player using a custom pool, call `pool.terminateAll()` to release its workers. Pool counts must be positive integers. Growing a pool is supported; shrinking below the number of initialized workers throws instead of terminating workers that may have active players. To shrink, destroy the affected players, call `terminateAll()`, then resize.

**Migration from 0.1.x:** Remove player-level `workerCount` props/options and the Web Component `worker-count` attribute. Use `configureTLottie({ workerCount })` or `initializeTLottie({ workerCount })` for the shared default pool, or pass an explicitly shared `pool`.

### Eager initialization

By default, the render worker and the wasm binary are both created/fetched lazily — the first `Worker` spins up when the first player mounts, and the wasm binary isn't requested until that player's animation source has resolved. Call `initializeTLottie()` any time earlier (module load, route change, hover intent, whatever fits your app) to warm both up ahead of time, so the first real player has nothing left to wait for:

```ts
import { initializeTLottie } from "tlottie";

initializeTLottie().catch(console.error); // handle download/initialization failures
// or: await initializeTLottie({ workerCount: 4, wasmUrl: "/custom/tlottie.wasm" });
```

`initializeTLottie({ workerCount: 4 })` sizes and warms the shared default pool that subsequent players use. With an explicit `pool`, the count applies to that pool instead. It never creates an inaccessible private pool. Every worker in the selected pool is warmed, since each owns its own WASM module instance. Repeated initialization reuses those workers. Worker startup failures reject the promise; handle it with `await` or `.catch()`.

## Browser support

Requires `OffscreenCanvas`, `requestAnimationFrame` inside a dedicated Worker, and (for `.tgs`) `DecompressionStream`. All are available in current Chrome/Edge/Firefox/Safari. No fallback path is implemented for older browsers.

## Development

This repo vendors [tlottie](https://github.com/dkaraush/tlottie) as a git submodule and ships a prebuilt `tlottie.wasm` — you don't need a Rust toolchain to work on the JS/TS side.

```sh
git clone --recurse-submodules https://github.com/erfanmola/tlottie.git
cd tlottie
bun install
bun run dev      # demo app at localhost:5173, imports straight from src/
bun run lint      # typecheck + biome
bun run build     # builds dist/ for every adapter
```

Native TypeScript 7 runs the repository and installed-package type checks. Vue/Svelte declaration generation uses the TypeScript 6 compiler API, which their current tooling requires; both are installed as development dependencies.

Rebuilding `src/core/tlottie.wasm` from the submodule (only needed after pulling submodule updates or touching the Rust source) requires a Rust toolchain with the `wasm32-unknown-unknown` target:

```sh
bun run build:wasm            # regular std build (the shipped default)
bun run build:wasm:no-std     # optional no_std build -> src/core/tlottie.no-std.wasm
```

The shipped package keeps the regular std build; the no_std binary is an opt-in cargo feature (`wasm,no-std` — allocator via dlmalloc over memory.grow, no libc imports) and is only produced when explicitly requested.


The build uses cargo's `release` profile (`opt-level = 3`) plus `wasm-opt -Oz` for dead-code elimination and stripping (via the `binaryen` devDependency, no system install needed). The current binary is 533,523 bytes; compressed sizes are approximately 211KB gzip and 166KB brotli. Configure compression on your host to reduce transfer size; `fetch()` handles it transparently.

### Repo layout

- `src/core/` — WASM loader, memory management, gzip decompression, framework-agnostic playback clock
- `src/worker/` — the render worker and its worker-pool
- `src/main/` — main-thread facade (`TLottie` class), fetch cache, shimmer helper
- `src/{vanilla,webcomponent,react,solid,vue,svelte}/` — framework adapters
- `src/bin/` — the `tlottie-outline` CLI
- `demo/` — a page per adapter, exercising load/play/error/gzip/resize

### CI

- `.github/workflows/pages.yml` — builds `demo/` and deploys it to [GitHub Pages](https://erfanmola.github.io/tlottie/) on every push to `master`.
- `.github/workflows/release.yml` — on a `package.json` version bump landing on `master`, builds and tests the installed package in fresh framework projects before publishing to npm and creating a matching GitHub Release. Needs the `NPM_TOKEN` repo secret to publish. Consumer screenshots and request results are uploaded as a workflow artifact.

## License

MIT — see [LICENSE](./LICENSE). The underlying [tlottie](https://github.com/dkaraush/tlottie) engine is also MIT.
