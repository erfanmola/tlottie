# Installed-package compatibility checks

Run these checks before a release, after building `dist/`:

```sh
bun install --frozen-lockfile
bun run build
bunx playwright install chromium
bun run test
bun run test:consumers
```

The harness packs the library with `npm pack`, then creates independent empty projects and installs that tarball into each project's `node_modules`. It does not use source aliases, symlinks, or workspace dependencies. Generated projects, lockfiles, screenshots, and `results.json` remain in `.consumer-tests/latest/` and are ignored by git.

Each project uses its usual framework plugin and loads both the JSON and gzip/TGS versions of the sample animation. Tests exercise default Vite development, development with `optimizeDeps.exclude: ['tlottie']`, and a production build served with `base: '/nested/'`. React runs inside `StrictMode`. The core TypeScript project additionally tests eager initialization with a page-relative public WASM URL and the `tlottie/wasm?url&no-inline` export.

The harness also checks that every public export exists in the tarball and compiles each adapter's public API/component props with TypeScript 7 and `skipLibCheck: false`. This catches missing declaration entry points, dangling declaration imports, and missing component types that a Vite runtime build can overlook.

The browser checks for two canvases, verifies that each canvas screenshot changes between animation frames, records worker/WASM HTTP responses, captures page screenshots, and rejects browser errors. These checks establish actual playback rather than merely a successful build or a load event. Screenshots should also be inspected before release.

## Verified versions

The 0.1.25 release was tested with Chrome on macOS, Vite 8.3.4, React 19.3.0, Vue 3.5.43, Solid 1.9.17, and Svelte 5.57.2.

| Installed consumer | Default Vite 8 dev | Excluded Vite 8 dev | Production under `/nested/` |
| --- | --- | --- | --- |
| React with StrictMode | Pass | Pass | Pass |
| Vue | Pass | Pass | Pass |
| Solid | Pass | Pass | Pass |
| Svelte | Pass | Pass | Pass |
| Vanilla TypeScript | Pass | Pass | Pass |
| Web Components | Pass | Pass | Pass |
| Core TypeScript | Pass | Pass | Pass |

Vite 6.4.4 and 7.3.7 core TypeScript consumers reproduce a worker 404 in default dev mode. Exclusion, custom WASM loading, and production playback pass. The same shared worker/asset code is emitted into all adapters, so use the documented exclusion consistently. This is a configuration requirement for Vite 6/7, not a promise that a version upgrade alone fixes optimization.

These checks cover fresh client-side Vite projects. They do not establish SSR rendering, every bundler, every browser, or every animation feature supported by the Rust engine.

## Targeted reproductions

```sh
# Pin the consumer's Vite independently of the library build tool.
CONSUMER_ADAPTER=core CONSUMER_VITE=7.3.7 bun run test:consumers

# Use an installed Chrome if the Playwright download is unavailable.
CONSUMER_CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' bun run test:consumers
```

`CONSUMER_ADAPTER` accepts `react`, `vue`, `solid`, `svelte`, `vanilla`, `webcomponent`, or `core`. Version-specific results live in `.consumer-tests/<CONSUMER_VITE>/`. For Vite 6/7, only the specific default-mode worker 404 is treated as an expected reproduction; all configured playback checks still must pass. Framework plugin versions are taken from the library's current dev dependencies, so select compatible plugins when testing older framework/Vite combinations.

The release workflow runs the full current-Vite matrix before publishing and uploads screenshots and request results. It publishes the already-built artifacts rather than rebuilding after the consumer checks.
