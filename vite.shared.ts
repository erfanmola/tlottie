import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const WASM_SOURCE = fileURLToPath(new URL("./src/core/tlottie.wasm", import.meta.url));
const WASM_SHARED_DIR = fileURLToPath(new URL("./dist", import.meta.url));

/**
 * Copies tlottie.wasm to a single shared `dist/tlottie.wasm`, one level up
 * from every `dist/<target>/index.js` — DEFAULT_WASM_URL resolves it via
 * `../tlottie.wasm`. Every one of the 7 build targets used to get its own
 * ~480KB copy (3.4MB of pure duplication across the published package);
 * they all reference this one file instead. Idempotent across the 7
 * sequential builds — each just overwrites it with the same bytes.
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
