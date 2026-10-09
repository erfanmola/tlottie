import { afterEach, beforeEach, expect, test } from "bun:test";
import { initializeTLottie } from "../src/main/initialize.ts";
import { TLottie } from "../src/main/TLottie.ts";
import { defaultWorkerPool, TLottieWorkerPool } from "../src/worker/pool.ts";

const originalWorker = globalThis.Worker;
class FakeWorker extends EventTarget {
	static created: FakeWorker[] = [];
	terminated = false;
	constructor() {
		super();
		FakeWorker.created.push(this);
	}
	postMessage(message: { requestId: string }) {
		queueMicrotask(() =>
			this.dispatchEvent(
				new MessageEvent("message", {
					data: { type: "warmed", requestId: message.requestId },
				}),
			),
		);
	}
	terminate() {
		this.terminated = true;
	}
}
beforeEach(() => {
	defaultWorkerPool.terminateAll();
	FakeWorker.created = [];
	globalThis.Worker = FakeWorker as unknown as typeof Worker;
});
afterEach(() => {
	defaultWorkerPool.terminateAll();
	globalThis.Worker = originalWorker;
});

test("initialization sizes and warms the pool subsequent players use", async () => {
	await initializeTLottie({ workerCount: 2 });
	expect(defaultWorkerPool.getAllWorkers()).toEqual(FakeWorker.created);
	const first = defaultWorkerPool.getWorker();
	const second = defaultWorkerPool.getWorker();
	expect(first).not.toBe(second);
	expect(defaultWorkerPool.getWorker()).toBe(first);
	await initializeTLottie();
	expect(FakeWorker.created).toHaveLength(2);
});

test("explicit shared pools are warmed without changing the default pool", async () => {
	const pool = new TLottieWorkerPool(1);
	await initializeTLottie({ pool, workerCount: 3 });
	expect(pool.getAllWorkers()).toHaveLength(3);
	expect(FakeWorker.created).toHaveLength(3);
	pool.terminateAll();
	expect(FakeWorker.created.every((worker) => worker.terminated)).toBe(true);
});

test("pool size rejects invalid counts and shrinking cannot kill active players", () => {
	for (const size of [0, -1, 1.5, NaN, Infinity])
		expect(() => new TLottieWorkerPool(size)).toThrow("positive integer");
	const pool = new TLottieWorkerPool(2);
	pool.getAllWorkers();
	expect(() => pool.setSize(1)).toThrow("cannot shrink");
	expect(FakeWorker.created.every((worker) => !worker.terminated)).toBe(true);
	pool.terminateAll();
	pool.setSize(1);
	expect(pool.getAllWorkers()).toHaveLength(1);
	pool.terminateAll();
});

test("worker startup errors reject warmup and permit creating a replacement", async () => {
	const worker = defaultWorkerPool.getWorker() as unknown as FakeWorker;
	worker.postMessage = () => {
		queueMicrotask(() => worker.dispatchEvent(new Event("error")));
	};
	await expect(initializeTLottie()).rejects.toThrow(
		"render worker failed to load",
	);
	expect(worker.terminated).toBe(true);
	expect(defaultWorkerPool.getWorker()).not.toBe(worker as unknown as Worker);
});

test("invalid warmup counts and worker constructor failures reject the returned promise", async () => {
	await expect(initializeTLottie({ workerCount: 0 })).rejects.toThrow(
		"positive integer",
	);
	globalThis.Worker = class {
		constructor() {
			throw new Error("startup blocked");
		}
	} as unknown as typeof Worker;
	await expect(initializeTLottie()).rejects.toThrow("startup blocked");
});

test("destroying one player keeps shared workers alive and errors reach remaining players", async () => {
	const names = ["window", "requestAnimationFrame", "cancelAnimationFrame"];
	const previous = names.map((name) =>
		Object.getOwnPropertyDescriptor(globalThis, name),
	);
	Object.defineProperties(globalThis, {
		window: { configurable: true, value: { devicePixelRatio: 1 } },
		requestAnimationFrame: {
			configurable: true,
			value: (callback: FrameRequestCallback) => {
				queueMicrotask(() => callback(0));
				return 1;
			},
		},
		cancelAnimationFrame: { configurable: true, value: () => {} },
	});
	const canvas = () =>
		({
			dataset: {},
			transferControlToOffscreen: () => ({}),
			getBoundingClientRect: () => ({ width: 64, height: 64 }),
		}) as unknown as HTMLCanvasElement;
	const pool = new TLottieWorkerPool(1);
	const first = new TLottie({ canvas: canvas(), data: "{}", pool });
	const second = new TLottie({ canvas: canvas(), data: "{}", pool });
	try {
		await Promise.resolve();
		await Promise.resolve();
		expect(FakeWorker.created).toHaveLength(1);
		const worker = FakeWorker.created[0];
		first.destroy();
		expect(worker.terminated).toBe(false);
		worker.dispatchEvent(new Event("error"));
		expect(second.state).toBe("error");
		expect(second.lastError?.reason).toBe("worker");
	} finally {
		first.destroy();
		second.destroy();
		pool.terminateAll();
		names.forEach((name, index) => {
			const descriptor = previous[index];
			if (descriptor) Object.defineProperty(globalThis, name, descriptor);
			else Reflect.deleteProperty(globalThis, name);
		});
	}
});
