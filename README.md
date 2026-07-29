# tlottie

[![npm version](https://img.shields.io/npm/v/tlottie.svg)](https://www.npmjs.com/package/tlottie)
[![license](https://img.shields.io/npm/l/tlottie.svg)](./LICENSE)

Fast, Web Worker–based [Lottie](https://airbnb.io/lottie/) and TGS (Telegram sticker) renderer, backed by the [tlottie](https://github.com/dkaraush/tlottie) Rust/WASM engine. Ships adapters for **React**, **SolidJS**, **Vue**, **Svelte**, **Web Components**, and **Vanilla JS**.

**[Live demo →](https://erfanmola.github.io/tlottie/)** — one page per adapter.

- **Off the main thread.** Parsing and rendering happen in a configurable pool of Web Workers, drawing into an `OffscreenCanvas` — no jank on the UI thread.
- **Fast core.** The underlying [tlottie](https://github.com/dkaraush/tlottie) engine benchmarks 23–73% faster frame times than rlottie/thorvg (see its own README for numbers).
- **TGS support.** Gzipped Lottie (`.tgs`, Telegram stickers) is decompressed in-worker using the browser-native `DecompressionStream` — no `pako`/`fflate` dependency.
- **Skeleton loading.** Pass an outline SVG and get a CSS `mask-image` shimmer while the animation loads or if it fails — generate that SVG with the bundled `tlottie-outline` CLI (`bunx tlottie-outline --input animation.json`).
- **Small.** Each framework adapter is ~3–4KB gzipped; the shared WASM binary (~418KB raw, ~131KB brotli / ~163KB gzip) is fetched once and cached, not bundled per adapter.

## Install

```sh
bun add tlottie
# or: npm install tlottie / pnpm add tlottie / yarn add tlottie
```

Framework peer dependencies (`react`, `solid-js`, `vue`, `svelte`) are optional — only install the one matching the adapter you use.

## Quick start

### React

```tsx
import { LottiePlayer } from "tlottie/react";

<LottiePlayer src="/animation.json" loop autoplay />;
```

### SolidJS

```tsx
import { LottiePlayer } from "tlottie/solid";

<LottiePlayer src="/animation.json" loop autoplay />;
```

### Vue

```vue
<script setup>
import { LottiePlayer } from "tlottie/vue";
</script>

<template>
	<LottiePlayer src="/animation.json" loop autoplay />
</template>
```

### Svelte

```svelte
<script>
	import { LottiePlayer } from "tlottie/svelte";
</script>

<LottiePlayer src="/animation.json" loop autoplay />
```

### Web Component

```js
import "tlottie/webcomponent";
```

```html
<tlottie-player src="/animation.json" loop autoplay></tlottie-player>
```

### Vanilla JS

```js
import { createTLottiePlayer } from "tlottie/vanilla";

const { tlottie, destroy } = createTLottiePlayer(document.getElementById("app"), {
	src: "/animation.json",
	loop: true,
	autoplay: true,
});
```

Each adapter also ships a stylesheet for the skeleton shimmer (only needed if you use the `outline` prop):

```js
import "tlottie/react/style.css"; // or /solid, /vue, /svelte, /vanilla, /webcomponent
```

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
| `workerCount`       | `number`                                    | Spins up a dedicated worker pool of this size just for this player.                          |
| `forceRender`       | `boolean`                                   | Keep rendering while off-screen (skips the IntersectionObserver auto-pause).                 |
| `reportFrames`      | `boolean`                                   | Emit throttled (~10Hz) `frame` events, for progress UIs. Off by default (costs a `postMessage` per emission). |
| `playOnClick`       | `boolean`                                   | Clicking the canvas calls `play()`. Mainly for non-looping animations: they play once, then replay on each click. |

### Worker pool

By default all players share a single worker (one worker already multiplexes any number of animations fine — each worker owns its own WASM module instance, so sizing the default off `navigator.hardwareConcurrency` just burns memory on typical multi-core machines for no benefit). Raise it if you've profiled a worker-bound workload:

```ts
import { configureTLottie } from "tlottie";

configureTLottie({ workerCount: 4 });
```

Or give one player its own dedicated pool via the `workerCount` prop.

### Eager initialization

By default, the render worker and the wasm binary are both created/fetched lazily — the first `Worker` spins up when the first player mounts, and the wasm binary isn't requested until that player's animation source has resolved. Call `initializeTLottie()` any time earlier (module load, route change, hover intent, whatever fits your app) to warm both up ahead of time, so the first real player has nothing left to wait for:

```ts
import { initializeTLottie } from "tlottie";

initializeTLottie(); // fire-and-forget is fine
// or: await initializeTLottie({ workerCount: 4, wasmUrl: "/custom/tlottie.wasm" });
```

Every worker in the (grown-to-full-size) pool is warmed, since each worker owns its own wasm module instance. Safe to call more than once or against multiple pools.

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

Rebuilding `src/core/tlottie.wasm` from the submodule (only needed after pulling submodule updates or touching the Rust source) requires a Rust toolchain with the `wasm32-unknown-unknown` target:

```sh
bun run build:wasm
```

The build uses cargo's `release` profile (`opt-level = 3`, full codegen quality) plus a `wasm-opt -Oz` pass for dead-code elimination and stripping (via the `binaryen` devDependency, no system install needed) — 488KB → 418KB raw, with no measurable render-speed cost (benchmarked; `opt-level = "z"` gets smaller still but is a real ~50% slower render path, not worth it here). What actually ships over the wire is smaller still, since `fetch()` transparently negotiates compression: 163KB gzip, 131KB brotli. Make sure whatever serves `dist/tlottie.wasm` in production sends `Content-Encoding` (most CDNs and static hosts do this automatically — a bare/unconfigured dev server might not).

### Repo layout

- `src/core/` — WASM loader, memory management, gzip decompression, framework-agnostic playback clock
- `src/worker/` — the render worker and its worker-pool
- `src/main/` — main-thread facade (`TLottie` class), fetch cache, shimmer helper
- `src/{vanilla,webcomponent,react,solid,vue,svelte}/` — framework adapters
- `src/bin/` — the `tlottie-outline` CLI
- `demo/` — a page per adapter, exercising load/play/error/gzip/resize

### CI

- `.github/workflows/pages.yml` — builds `demo/` and deploys it to [GitHub Pages](https://erfanmola.github.io/tlottie/) on every push to `main`.
- `.github/workflows/release.yml` — on a `package.json` version bump landing on `main`, publishes to npm and creates a matching GitHub Release with auto-generated notes. Needs an `NPM_TOKEN` repo secret (an npm automation token with publish access) to actually publish; without it the workflow fails at the publish step.

## License

MIT — see [LICENSE](./LICENSE). The underlying [tlottie](https://github.com/dkaraush/tlottie) engine is also MIT.
