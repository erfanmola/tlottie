---
name: tlottie-dev
description: "Use when working on the tlottie repo itself (this project) — a web-worker/WASM Lottie+TGS renderer with React/Solid/Vue/Svelte/Web Component/Vanilla adapters. Load before touching src/, vite.*.config.ts, scripts/build-wasm.sh, or the tlottie-outline CLI, to avoid re-discovering the non-obvious build/runtime constraints documented here."
---

# tlottie-dev

Internal map + gotchas for developing the `tlottie` package itself. Read this before making changes — several of the constraints below were only found by hitting real build/runtime failures; skipping them reintroduces bugs that were already fixed once.

## Architecture (read in this order)

- `tlottie/` — git submodule, the Rust/WASM engine (`dkaraush/tlottie`). Raw `wasm32-unknown-unknown` build, **no JS glue** — exports are plain `extern "C"` functions (`src/bindings/wasm.rs`), all manual malloc/free/pointer plumbing.
- `src/core/` — the low-level bridge to that WASM: `wasm.ts` (loader), `memory.ts` (alloc/read helpers), `instance.ts` (`TLottieInstance`, wraps a `tlottie_new` pointer), `gzip.ts` (native `DecompressionStream`, no pako), `player-engine.ts` (framework-agnostic playback clock — pure logic, no DOM). No playback state exists in the Rust core; the clock is entirely host-side.
- `src/worker/` — `tlottie.worker.ts` (owns one WASM module instance per worker, reused across every animation routed to it), `pool.ts` (round-robin worker pool, default size **1**, not `hardwareConcurrency` — see below), `protocol.ts` (message types).
- `src/main/TLottie.ts` — the main-thread facade class. IntersectionObserver + ResizeObserver, transfers canvas control to the worker, real `error` event (unlike most cheap Lottie wrappers, which silently hang on fetch/parse failure).
- `src/{vanilla,webcomponent,react,solid,vue,svelte}/` — adapters. All wrap `TLottie`; each has its own remount-on-source-change strategy (see gotcha below).
- `src/bin/lottie-to-outline.ts` — the `tlottie-outline` CLI, reuses `core/gzip.ts` + `core/instance.ts` directly (dogfoods the library instead of a separate thorvg/pako toolchain).
- `demo/` — one page per adapter, source-imported (not built) so `bun run dev` never needs a prior build.

## Commands

```sh
bun run dev          # demo at localhost:5173, imports straight from src/
bun run lint          # typecheck (4 tsconfigs) + biome
bun run build          # dist/ for all 7 lib targets + the CLI (8 vite configs, sequential)
bun run build:wasm      # rebuild src/core/tlottie.wasm from the submodule (needs Rust + wasm32 target)
bun run outline -- --input x.json   # run the outline CLI from source, no build needed
```

Every `vite.*.config.ts` is a **separate config** — React/Solid both use `.tsx`, Vue/Svelte have their own SFC compilers, none of this can share one Vite config. `scripts/build.ts` just runs them in sequence.

## Gotchas (each cost real debugging time once — don't re-hit them)

1. **Never cache a typed-array view into wasm memory across a `tlottie_*` call.** `memory.grow()` detaches prior `ArrayBuffer`s. `core/memory.ts` centralizes every read; nothing else should touch `exports.memory.buffer` directly.

2. **`new URL("./tlottie.wasm", import.meta.url)` written literally gets base64-inlined by Vite in library mode**, regardless of `assetsInlineLimit`. Fix in `core/wasm-url.ts`: route `import.meta.url` through a variable first to dodge Vite's static-asset detector, and let `copyWasmPlugin` (`vite.shared.ts`) place the real file. `import.meta.env.DEV` picks `./tlottie.wasm` (dev, same folder as `src/core/`) vs `../tlottie.wasm` (build, one level up from every `dist/<target>/index.js` — there's exactly one shared copy at `dist/tlottie.wasm`, not one per target; it used to be duplicated 7×, 3.6MB of pure waste, before this was fixed).

3. **`vite-plugin-dts` emits `.d.ts` files with the source's own `./foo.ts` specifiers**, not rewritten to `.d.ts`/extensionless. Breaks resolution for consumers. `fixDtsExtensionsPlugin` in `vite.shared.ts` strips the `.ts` extension from every emitted declaration file post-hoc. `rollupTypes: true` does not work reliably under TS7's compiler API right now — don't rely on it, the multi-file `.d.ts` tree is fine.

4. **A literal shebang in the source file (`#!/usr/bin/env node`) plus a Rollup `output.banner` shebang produces `DUPLICATE_SHEBANG` and silently truncates the whole bundle to just the shebang line.** `vite.bin.config.ts` relies on Rollup auto-detecting the source shebang — don't add a banner.

5. **Framework adapters must remount the `<canvas>` element (not just re-render into the same one) when `src`/`data` changes.** `transferControlToOffscreen()` can only be called once per canvas ever — reusing the DOM node throws `InvalidStateError` on the second call. Each adapter solves this differently: React uses a source-derived `key` on the canvas, Solid uses `<Show keyed>`, Vue uses `:key` + a watcher that unmounts/remounts after `nextTick`, Svelte uses `{#key sourceKey}` + an `$effect` keyed on the canvas ref. This was a real shipped bug (found via headless-browser testing, not typecheck) — if you touch mount logic in any adapter, re-verify src-change actually reloads the animation, not just initial mount.

6. **CSS animations must animate `transform`/`opacity` only, never `background-position`.** The shimmer previously animated `background-position` for the sweep — measured 119.8 style-recalc/sec (matched a user report of "~120/sec" exactly). Fixed in `src/style/shimmer.scss` via a `::after` pseudo-element animating `transform: translateX()` only (0 recalcs/sec, confirmed via CDP `Performance.getMetrics`), plus `animation-play-state: paused` on `.tlottie-hidden` — an `opacity: 0` element does NOT stop its own running keyframe animation.

7. **`wasm-opt` requires `--enable-nontrapping-float-to-int` etc., or it fails validation** on anything rustc emits for a modern target (`i32.trunc_sat_f64_s` and friends). See the exact flag list in `scripts/build-wasm.sh`.

8. **`opt-level = "z"` (`release-size` cargo profile) is ~50% slower to render, not just smaller** — measured, not assumed (488KB→306KB but 0.25ms→0.38ms/frame). Shipped choice is `release` (`opt-level = 3`) + `wasm-opt -Oz` for DCE/stripping only: 488KB→418KB with *no* speed cost (occasionally faster, better icache locality). If anyone suggests `release-size` again, point at this — it was tested and rejected on purpose. `panic = "abort"` was also tested and is a no-op on `wasm32-unknown-unknown` (no unwind tables generated regardless).

9. **Default worker pool size is 1, not `navigator.hardwareConcurrency`-scaled.** Each worker owns its own WASM module instance; one worker already multiplexes any number of animations fine. Sizing off core count was pure waste on typical 8-16 core machines. `configureTLottie({ workerCount })` overrides it.

10. **`@neplex/vectorizer`'s `vectorizeRaw` takes the raw RGBA buffer directly** — no `canvas`/PNG-encoding step needed, unlike the reference implementation this CLI was ported from (`erfanmola/lottie-output-generator`, thorvg+pako+canvas based). The installed version also ships its own SVG optimizer (`optimize()`), so `svgo` isn't a dependency here.

11. **`demo/` had never actually been through a production `vite build` before — only ever `vite dev`.** That hid two real bugs until GitHub Pages support forced an actual build+serve test:
    - Demo pages fetched `/assets/sample.json` etc. as hardcoded absolute paths, which only resolved because `vite dev` serves the whole project root. A real build never copies arbitrary runtime-fetched strings anywhere. Fixed via `publicDir: "assets"` in `demo/vite.config.ts` (serves/copies those files at the site root) plus `demo/asset-url.ts`'s `assetUrl()` helper (prefixes `import.meta.env.BASE_URL`, so it's correct under both `/` dev and the `/tlottie/` GitHub Pages subpath). `tlottie.wasm` itself needed the same treatment — `copyWasmToOutDirPlugin` in `vite.shared.ts`.
    - The webcomponent demo relied on `import "../../src/webcomponent/index.ts"` for its self-registering side effect. package.json's `sideEffects` allowlist only covers `./dist/webcomponent/*.js` (what published consumers get) — a same-repo import straight from `src/` isn't covered, so Rollup correctly tree-shook the registration call away in a real production build (worked fine in dev, where nothing gets tree-shaken). Fixed by importing `registerTLottiePlayerElement` as a named export and calling it explicitly in `demo/webcomponent/main.ts`, instead of relying on an implicit side-effect import — more robust regardless of any bundler's tree-shaking config, not just a `sideEffects` field tweak.
    - **Lesson: `vite dev` working is not evidence a `vite build` works.** If you touch demo asset loading or the webcomponent registration path again, actually run `vite build --config demo/vite.config.ts` and serve the output (a plain dev server masks both of the above).

## Where the real numbers came from

Every size/speed/recalc figure in the README and code comments is measured, not estimated — via `twiggy` (symbol-level wasm size breakdown), a raw-WASM Node benchmark harness (bypasses the browser entirely to isolate wasm compute from canvas/paint), and Chrome DevTools Protocol `Performance.getMetrics` for the recalc-storm diagnosis. If you change the wasm build flags or the shimmer CSS again, re-measure — don't guess and update the comments from vibes.
