// Small default so a page with many players doesn't spin up one worker per
// core; callers who profile their own workload can raise this with
// configureTLottie({ workerCount }) or a per-pool setSize().
const DEFAULT_POOL_SIZE =
	typeof navigator !== "undefined" && navigator.hardwareConcurrency
		? Math.max(1, Math.min(4, Math.floor(navigator.hardwareConcurrency / 2)))
		: 2;

/** Round-robin pool of tlottie render workers, grown lazily up to `size`. */
export class TLottieWorkerPool {
	private workers: Worker[] = [];
	private nextIndex = -1;
	private size: number;

	constructor(size: number = DEFAULT_POOL_SIZE) {
		this.size = Math.max(1, size);
	}

	setSize(size: number): void {
		if (size < 1)
			throw new Error("tlottie: worker pool size must be at least 1");
		this.size = size;
		while (this.workers.length > size) {
			this.workers.pop()?.terminate();
		}
	}

	getWorker(): Worker {
		if (this.workers.length < this.size) {
			const worker = new Worker(
				new URL("./tlottie.worker.ts", import.meta.url),
				{ type: "module" },
			);
			this.workers.push(worker);
			this.nextIndex = this.workers.length - 1;
			return worker;
		}
		this.nextIndex = (this.nextIndex + 1) % this.workers.length;
		return this.workers[this.nextIndex];
	}

	terminateAll(): void {
		for (const worker of this.workers) worker.terminate();
		this.workers = [];
		this.nextIndex = -1;
	}
}

export const defaultWorkerPool = new TLottieWorkerPool();
