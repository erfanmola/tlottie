import { expect, test } from "bun:test";
import { resolveWasmUrl } from "../src/main/wasm-url.ts";

test("custom WASM URLs resolve against the page base before reaching a worker", () => {
	const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
	Object.defineProperty(globalThis, "document", {
		configurable: true,
		value: { baseURI: "https://example.test/nested/" },
	});
	try {
		expect(resolveWasmUrl("./tlottie.wasm")).toBe(
			"https://example.test/nested/tlottie.wasm",
		);
		expect(resolveWasmUrl("/tlottie.wasm")).toBe(
			"https://example.test/tlottie.wasm",
		);
		expect(resolveWasmUrl(new URL("https://cdn.test/custom.wasm"))).toBe(
			"https://cdn.test/custom.wasm",
		);
	} finally {
		if (previous) Object.defineProperty(globalThis, "document", previous);
		else Reflect.deleteProperty(globalThis, "document");
	}
});
