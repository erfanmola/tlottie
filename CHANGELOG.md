# Changelog

## 0.2.0

- Remove the ineffective player-level `workerCount` option from every adapter and the Web Component `worker-count` attribute. Use shared pool configuration or an explicitly shared `pool` instead.
- Make `initializeTLottie({ workerCount })` resize and warm the shared pool subsequent players actually use, including explicitly supplied pools.
- Make all packaged adapters import the same core runtime, so root configuration and warmup apply to every adapter. Canonicalize shared declarations so pools from the root package work with adapter props.
- Validate positive integer pool sizes and reject unsafe shrinking of initialized pools instead of terminating active players' workers.
- Reject warmup on worker startup failures, report player worker errors, discard failed workers, and allow replacement workers to be created.
- Extend installed-package checks to verify core identity and that two warmed workers are reused by two players without additional worker creation.

## 0.1.25

- Resolve custom relative WASM URLs against the page before sending them to a worker.
- Retry failed WASM initialization instead of caching rejected promises forever; respect changes to the requested WASM URL.
- Report HTTP failures with the WASM URL and status. Reuse the fetched response when streaming instantiation falls back because of an incorrect MIME type.
- Export `tlottie/wasm` for custom asset hosting and bundler URL imports.
- Fix adapter declaration entry points and JSX import extensions; ship generated Vue and Svelte component declarations. Correct the Svelte peer requirement to version 5, which the compiled adapter requires.
- Document Vite dependency-optimization exclusions, required adapter styles and sizing, asset deployment, and custom WASM hosting.
- Add installed-tarball browser tests for React, Vue, Solid, Svelte, vanilla TypeScript, Web Components, and the core API, including JSON/TGS playback and nested production paths.
- Update JavaScript dependencies and CI actions. Check the engine submodule against upstream `main`; it remains at `92df98dc209bc39b1e567ec74a8c86a0af5239de`.
