import { execFileSync } from "node:child_process";
import {
	copyFileSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

// Real tarball installs, never aliases or workspace links. Keep failed apps
// and screenshots available for diagnosis; generated projects are ignored.
const root = resolve(import.meta.dirname, "..");
const output = resolve(
	root,
	".consumer-tests",
	process.env.CONSUMER_VITE ?? "latest",
);
mkdirSync(output, { recursive: true });
const run = (cmd, args, cwd = root) =>
	execFileSync(cmd, args, { cwd, stdio: "pipe" }).toString();
const packed = JSON.parse(
	run("npm", [
		"pack",
		"--json",
		"--ignore-scripts",
		"--pack-destination",
		output,
	]),
)[0];
const tarball = resolve(
	output,
	`tlottie-${packed.version}-${packed.shasum}.tgz`,
);
renameSync(resolve(output, packed.filename), tarball);
const pkg = JSON.parse(readFileSync(resolve(root, "package.json")));
for (const [entry, value] of Object.entries(pkg.exports)) {
	for (const target of typeof value === "string"
		? [value]
		: Object.values(value)) {
		if (!packed.files.some((file) => file.path === target.replace(/^\.\//, "")))
			throw new Error(`Missing packed export ${entry}: ${target}`);
	}
}
const browser = await chromium.launch(
	process.env.CONSUMER_CHROME
		? { executablePath: process.env.CONSUMER_CHROME }
		: {},
);
const results = [];
const adapters = [
	"react",
	"vue",
	"solid",
	"svelte",
	"vanilla",
	"webcomponent",
	"core",
];
const only = process.env.CONSUMER_ADAPTER;
const write = (dir, name, data) => writeFileSync(resolve(dir, name), data);
try {
	for (const adapter of adapters.filter((a) => !only || a === only)) {
		const entry = adapter === "core" ? "tlottie" : `tlottie/${adapter}`;
		const dir = resolve(output, adapter);
		rmSync(dir, { recursive: true, force: true });
		mkdirSync(resolve(dir, "public"), { recursive: true });
		const names =
			{
				react: [
					"react",
					"react-dom",
					"@vitejs/plugin-react",
					"@types/react",
					"@types/react-dom",
				],
				vue: ["vue", "@vitejs/plugin-vue"],
				solid: ["solid-js", "vite-plugin-solid"],
				svelte: ["svelte", "@sveltejs/vite-plugin-svelte"],
			}[adapter] ?? [];
		write(
			dir,
			"package.json",
			JSON.stringify(
				{
					name: `consumer-${adapter}`,
					private: true,
					type: "module",
					dependencies: {
						tlottie: `file:${tarball}`,
						vite: process.env.CONSUMER_VITE ?? pkg.devDependencies.vite,
						typescript: pkg.devDependencies.typescript7,
						...Object.fromEntries(
							names.map((n) => [n, pkg.devDependencies[n]]),
						),
					},
				},
				null,
				2,
			),
		);
		copyFileSync(
			resolve(root, "demo/assets/sample.json"),
			resolve(dir, "public/sample.json"),
		);
		copyFileSync(
			resolve(root, "demo/assets/sample.tgs"),
			resolve(dir, "public/sample.tgs"),
		);
		copyFileSync(
			resolve(root, "dist/tlottie.wasm"),
			resolve(dir, "public/tlottie.wasm"),
		);
		write(
			dir,
			"index.html",
			`<html><head><link rel="icon" href="data:,"><title>${adapter} consumer</title></head><body><h1>${adapter} installed package</h1><div id="app"></div><script type="module" src="/bootstrap.ts"></script></body></html>`,
		);
		write(
			dir,
			"style.css",
			"body{font:16px system-ui;background:#edf2f7;color:#172234} .tlottie-player,tlottie-player,canvas{display:block;width:256px;height:256px} #app{display:flex;gap:24px}",
		);
		const common = `import './style.css';\n`;
		write(
			dir,
			"bootstrap.ts",
			`import { initializeTLottie, TLottie as CoreTLottie } from 'tlottie'; import { TLottie as AdapterTLottie } from '${entry}'; if (CoreTLottie !== AdapterTLottie) throw new Error('adapter has a duplicate core runtime'); initializeTLottie({workerCount:2}).then(() => import('./main.${["react", "solid"].includes(adapter) ? "tsx" : "ts"}'));`,
		);
		const props = `src={src} loop autoplay`;
		const sources = `['/nested/sample.json','/nested/sample.tgs']`;
		if (adapter === "react")
			write(
				dir,
				"main.tsx",
				common +
					`import {StrictMode} from 'react'; import {createRoot} from 'react-dom/client'; import {LottiePlayer} from 'tlottie/react'; import 'tlottie/react/style.css'; createRoot(document.getElementById('app')!).render(<StrictMode>{${sources}.map(src=><LottiePlayer key={src} ${props}/>)}</StrictMode>);`,
			);
		if (adapter === "solid")
			write(
				dir,
				"main.tsx",
				common +
					`import {render} from 'solid-js/web'; import {LottiePlayer} from 'tlottie/solid'; import 'tlottie/solid/style.css'; render(()=> <>{${sources}.map(src=><LottiePlayer ${props}/>)}</>,document.getElementById('app')!);`,
			);
		if (adapter === "vue") {
			write(
				dir,
				"App.vue",
				`<script setup lang="ts">import {LottiePlayer} from 'tlottie/vue'; import 'tlottie/vue/style.css';</script><template><LottiePlayer v-for="src in ${sources}" :key="src" :src="src" loop autoplay /></template>`,
			);
			write(
				dir,
				"main.ts",
				common +
					`import {createApp} from 'vue'; import App from './App.vue'; createApp(App).mount('#app');`,
			);
		}
		if (adapter === "svelte") {
			write(
				dir,
				"App.svelte",
				`<script lang="ts">import {LottiePlayer} from 'tlottie/svelte'; import 'tlottie/svelte/style.css';</script>{#each ${sources} as src}<LottiePlayer {src} loop autoplay />{/each}`,
			);
			write(
				dir,
				"main.ts",
				common +
					`import {mount} from 'svelte'; import App from './App.svelte'; mount(App,{target:document.getElementById('app')!});`,
			);
		}
		if (adapter === "vanilla")
			write(
				dir,
				"main.ts",
				common +
					`import {createTLottiePlayer} from 'tlottie/vanilla'; import 'tlottie/vanilla/style.css'; for(const src of ${sources}) createTLottiePlayer(document.getElementById('app')!,{src,loop:true,autoplay:true});`,
			);
		if (adapter === "webcomponent")
			write(
				dir,
				"main.ts",
				common +
					`import 'tlottie/webcomponent'; import 'tlottie/webcomponent/style.css'; for(const src of ${sources}) {const el=document.createElement('tlottie-player'); el.setAttribute('src',src); el.setAttribute('loop',''); document.getElementById('app')!.append(el);}`,
			);
		if (adapter === "core")
			write(
				dir,
				"main.ts",
				common +
					`import {TLottie} from 'tlottie'; for(const src of ${sources}) {const canvas=document.createElement('canvas'); document.getElementById('app')!.append(canvas); new TLottie({canvas,src,loop:true,autoplay:true});}`,
			);
		run("bun", ["install"], dir);
		let typeTest = `import {TLottie, initializeTLottie} from '${entry}'; const player = new TLottie({canvas:document.createElement('canvas'),src:'/animation.json'}); player.setSpeed(2); void initializeTLottie;`;
		typeTest += `import {TLottieWorkerPool} from 'tlottie'; const pool = new TLottieWorkerPool(2);\n// @ts-expect-error speed must be numeric\nplayer.setSpeed('fast');\n`;
		typeTest += `\n// @ts-expect-error worker counts configure pools, not individual players\nnew TLottie({canvas:document.createElement('canvas'),data:'{}',workerCount:2});\n`;
		if (["react", "solid"].includes(adapter))
			typeTest += `import {type LottiePlayerProps, LottiePlayer} from '${entry}'; const props:LottiePlayerProps = {src:'/animation.json',loop:true,pool}; void props; void LottiePlayer;`;
		if (adapter === "vue")
			typeTest += `import {LottiePlayer} from '${entry}'; const props:InstanceType<typeof LottiePlayer>['$props'] = {src:'/animation.json',loop:true,pool}; void props;`;
		if (adapter === "svelte")
			typeTest += `import {type ComponentProps} from 'svelte'; import {LottiePlayer} from '${entry}'; const props:ComponentProps<typeof LottiePlayer> = {src:'/animation.json',loop:true,pool}; void props;`;
		write(dir, "types.ts", typeTest);
		write(
			dir,
			"tsconfig.json",
			JSON.stringify({
				compilerOptions: {
					target: "ESNext",
					module: "ESNext",
					moduleResolution: "bundler",
					strict: true,
					noEmit: true,
					skipLibCheck: false,
					lib: ["ESNext", "DOM", "DOM.Iterable"],
				},
				include: ["types.ts"],
			}),
		);
		try {
			run(
				"node",
				["node_modules/typescript/bin/tsc", "-p", "tsconfig.json"],
				dir,
			);
			results.push({ adapter, mode: "types", passed: true });
			console.log(`PASS ${adapter} types`);
		} catch (error) {
			results.push({
				adapter,
				mode: "types",
				passed: false,
				errors: [error.stdout?.toString() ?? error.message],
			});
			console.error(`FAIL ${adapter} types`, error.stdout?.toString());
		}
		const plugin = {
			react: ["@vitejs/plugin-react", "react"],
			vue: ["@vitejs/plugin-vue", "vue"],
			solid: ["vite-plugin-solid", "solid"],
			svelte: ["@sveltejs/vite-plugin-svelte", "svelte"],
		}[adapter];
		const pluginImport = plugin
			? `import {${plugin[1]}} from '${plugin[0]}';`
			: "";
		const actualImport =
			plugin && adapter !== "svelte"
				? `import ${plugin[1]} from '${plugin[0]}';`
				: pluginImport;
		for (const mode of [
			"default",
			"excluded",
			"production",
			...(adapter === "core" ? ["custom-wasm", "imported-wasm"] : []),
		]) {
			if (mode === "custom-wasm")
				write(
					dir,
					"main.ts",
					common +
						`import {TLottie, initializeTLottie} from 'tlottie'; await initializeTLottie({wasmUrl:'./tlottie.wasm'}); for(const src of ${sources}) {const canvas=document.createElement('canvas'); document.getElementById('app')!.append(canvas); new TLottie({canvas,src,loop:true,autoplay:true,wasmUrl:'./tlottie.wasm'});}`,
				);
			if (mode === "imported-wasm")
				write(
					dir,
					"main.ts",
					common +
						`import wasmUrl from 'tlottie/wasm?url&no-inline'; import {TLottie, initializeTLottie} from 'tlottie'; await initializeTLottie({wasmUrl}); for(const src of ${sources}) {const canvas=document.createElement('canvas'); document.getElementById('app')!.append(canvas); new TLottie({canvas,src,loop:true,autoplay:true,wasmUrl});}`,
				);
			write(
				dir,
				"vite.config.js",
				`${actualImport} export default {base:'/nested/', plugins:[${plugin ? plugin[1] + "()" : ""}], ${["excluded", "custom-wasm", "imported-wasm"].includes(mode) ? "optimizeDeps:{exclude:['tlottie']}," : ""}};`,
			);
			let server;
			const errors = [];
			const responses = [];
			const page = await browser.newPage({
				viewport: { width: 800, height: 400 },
			});
			await page.addInitScript(() => {
				window.__workerCount = 0;
				const OriginalWorker = window.Worker;
				window.Worker = class extends OriginalWorker {
					constructor(...args) {
						super(...args);
						window.__workerCount++;
					}
				};
			});
			page.on("pageerror", (e) => errors.push(e.message));
			page.on("console", (msg) => {
				if (msg.type() === "error") errors.push(msg.text());
			});
			page.on("response", (response) => {
				if (/wasm|worker/.test(response.url()))
					responses.push({ url: response.url(), status: response.status() });
			});
			try {
				const { createServer, preview, build } = await import(
					resolve(dir, "node_modules/vite/dist/node/index.js")
				);
				if (mode === "production")
					await build({ root: dir, logLevel: "error" });
				server =
					mode === "production"
						? await preview({
								root: dir,
								logLevel: "error",
								preview: { port: 0 },
							})
						: await createServer({
								root: dir,
								logLevel: "error",
								server: { port: 0 },
							});
				if (mode !== "production") await server.listen();
				const port = server.httpServer.address().port;
				await page.goto(`http://localhost:${port}/nested/`);
				await page.waitForTimeout(2500);
				const canvases = await page.locator("canvas").count();
				const shots = [];
				for (let i = 0; i < canvases; i++)
					shots.push(await page.locator("canvas").nth(i).screenshot());
				await page.waitForTimeout(500);
				let animated = canvases === 2;
				for (let i = 0; i < canvases; i++)
					animated &&= !shots[i].equals(
						await page.locator("canvas").nth(i).screenshot(),
					);
				await page.screenshot({
					path: resolve(output, `${adapter}-${mode}.png`),
				});
				const workerCount = await page.evaluate(() => window.__workerCount);
				const passed =
					workerCount === 2 &&
					animated &&
					errors.length === 0 &&
					responses.some((r) => r.url.includes(".wasm") && r.status === 200);
				// Vite 6/7 require the documented exclude setting. Prove that exact
				// failure, rather than accepting arbitrary failures in default mode.
				const expectedFailure =
					!passed &&
					mode === "default" &&
					/^[67]\./.test(process.env.CONSUMER_VITE ?? "") &&
					responses.some(
						(r) =>
							r.status === 404 &&
							r.url.includes("/.vite/deps/assets/tlottie.worker"),
					);
				const result = {
					adapter,
					mode,
					passed,
					expectedFailure,
					animated,
					workerCount,
					errors,
					responses,
				};
				results.push(result);
				console.log(
					`${result.passed ? "PASS" : result.expectedFailure ? "EXPECTED FAILURE" : "FAIL"} ${adapter} ${mode}`,
					errors,
				);
			} catch (e) {
				results.push({ adapter, mode, passed: false, errors: [e.stack] });
				console.error(`FAIL ${adapter} ${mode}: ${e.message}`);
			} finally {
				await page.close();
				if (server) await server.close();
			}
		}
	}
} finally {
	await browser.close();
	write(output, "results.json", JSON.stringify(results, null, 2));
}
if (results.some((r) => !r.passed && !r.expectedFailure)) process.exitCode = 1;
