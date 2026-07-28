# tlottie

[![npm version](https://img.shields.io/npm/v/tlottie.svg)](https://www.npmjs.com/package/tlottie)
[![license](https://img.shields.io/npm/l/tlottie.svg)](./LICENSE)

Fast, Web Worker–based [Lottie](https://airbnb.io/lottie/) and TGS (Telegram sticker) renderer, backed by the [tlottie](https://github.com/dkaraush/tlottie) Rust/WASM engine. Ships adapters for **React**, **SolidJS**, **Vue**, **Svelte**, **Web Components**, and **Vanilla JS**.

- **Off the main thread.** Parsing and rendering happen in a configurable pool of Web Workers, drawing into an `OffscreenCanvas` — no jank on the UI thread.
- **Fast core.** The underlying [tlottie](https://github.com/dkaraush/tlottie) engine benchmarks 23–73% faster frame times than rlottie/thorvg (see its own README for numbers).
- **TGS support.** Gzipped Lottie (`.tgs`, Telegram stickers) is decompressed in-worker using the browser-native `DecompressionStream` — no `pako`/`fflate` dependency.
- **Skeleton loading.** Pass an outline SVG and get a CSS `mask-image` shimmer while the animation loads or if it fails.
- **Small.** Each framework adapter is ~3–4KB gzipped; the shared WASM binary (~480KB) is fetched once and cached, not bundled per adapter.

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

### Worker pool

By default all players share one small pool of workers (sized off `navigator.hardwareConcurrency`). Configure it globally before creating any players:

```ts
import { configureTLottie } from "tlottie";

configureTLottie({ workerCount: 4 });
```

Or give one player its own dedicated pool via the `workerCount` prop.

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

### Repo layout

- `src/core/` — WASM loader, memory management, gzip decompression, framework-agnostic playback clock
- `src/worker/` — the render worker and its worker-pool
- `src/main/` — main-thread facade (`TLottie` class), fetch cache, shimmer helper
- `src/{vanilla,webcomponent,react,solid,vue,svelte}/` — framework adapters
- `demo/` — a page per adapter, exercising load/play/error/gzip/resize

## License

MIT — see [LICENSE](./LICENSE). The underlying [tlottie](https://github.com/dkaraush/tlottie) engine is also MIT.
