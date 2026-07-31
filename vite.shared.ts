import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const WASM_SOURCE = fileURLToPath(new URL("./src/core/tlottie.wasm", import.meta.url));
const WASM_SHARED_DIR = fileURLToPath(new URL("./dist", import.meta.url));

/**
 * Copies tlottie.wasm to `dist/tlottie.wasm`, one level up from
 * `dist/bin/lottie-to-outline.js` — the CLI reads it straight off disk (see
 * src/bin/lottie-to-outline.ts), so it needs a real file at a fixed path
 * rather than the `?url` asset import the browser worker uses. The 7
 * browser build targets each get their own wasm copy via that `?url`
 * import instead (resolved and emitted per-target by Vite's own asset
 * pipeline), so this plugin is only wired into vite.bin.config.ts now.
 */
export function copyWasmPlugin(): Plugin {
	return {
		name: "tlottie-copy-wasm",
		apply: "build",
		writeBundle() {
			mkdirSync(WASM_SHARED_DIR, { recursive: true });
			copyFileSync(WASM_SOURCE, `${WASM_SHARED_DIR}/tlottie.wasm`);
		},
	};
}

/**
 * Same idea as copyWasmPlugin, but for single-target builds (the demo app)
 * where there's no cross-config sharing concern — copies straight into
 * whatever outDir this specific build actually resolves to.
 */
export function copyWasmToOutDirPlugin(): Plugin {
	return {
		name: "tlottie-copy-wasm-to-outdir",
		apply: "build",
		writeBundle(options) {
			const outDir = options.dir ?? "dist";
			mkdirSync(outDir, { recursive: true });
			copyFileSync(WASM_SOURCE, `${outDir}/tlottie.wasm`);
		},
	};
}

/**
 * vite-plugin-dts emits declaration files with the source's own
 * `./foo.ts`-style specifiers (needed in source under
 * `allowImportingTsExtensions`) instead of rewriting them to match the
 * emitted `.d.ts` tree, which breaks resolution for consumers. Strips the
 * `.ts` extension from every relative import/export specifier in every
 * emitted `.d.ts` file, closeBundle runs after dts's own writeBundle.
 */
export function fixDtsExtensionsPlugin(outDir: string): Plugin {
	return {
		name: "tlottie-fix-dts-extensions",
		apply: "build",
		closeBundle() {
			walk(outDir);
		},
	};
}

function walk(dir: string): void {
	if (!existsSync(dir)) return;
	for (const entry of readdirSync(dir)) {
		const full = `${dir}/${entry}`;
		const stat = statSync(full);
		if (stat.isDirectory()) {
			walk(full);
		} else if (entry.endsWith(".d.ts")) {
			const content = readFileSync(full, "utf8");
			const fixed = content.replace(/(from\s+["'][^"']+?)\.ts(["'])/g, "$1$2");
			if (fixed !== content) writeFileSync(full, fixed);
		}
	}
}
