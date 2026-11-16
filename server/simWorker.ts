// Aislamiento de simulación por sala y pool de Worker Threads (node:worker_threads).
import { cpus } from 'node:os';
import { Worker } from 'node:worker_threads';
import { step } from '../src/shared/sim';
import type { GameEvent, MatchState, PlayerInput } from '../src/shared/types';

interface PendingJob {
  resolve: (state: MatchState) => void;
  reject: (err: unknown) => void;
}

/**
 * Pool de simulación por sala.
 * - `stepSync` ejecuta un tick aislado por sala en el hilo actual (baja latencia a 60 Hz).
 * - `stepAsync` delega el cálculo de `step(state, inputs)` a un Worker Thread por clave de sala.
 */
export class SimWorkerPool {
  private workers: Worker[] = [];
  private pending = new Map<number, PendingJob>();
  private nextId = 1;
  private closed = false;
  readonly size: number;

  constructor(size = Math.max(1, Math.min(4, cpus().length - 1))) {
    this.size = Math.max(1, size);
  }

  /** Ejecuta un tick de simulación aislado para una sala en forma síncrona. */
  stepSync(state: MatchState, inputs: Record<number, PlayerInput>): GameEvent[] {
    step(state, inputs);
    return state.events;
  }

  /** Ejecuta un tick de simulación en un Worker Thread asignado por clave de sala. */
  stepAsync(state: MatchState, inputs: Record<number, PlayerInput>, roomKey = 'default'): Promise<MatchState> {
    if (this.closed) return Promise.reject(new Error('SimWorkerPool está cerrado'));
    const w = this.getWorker(roomKey);
    const id = this.nextId++;
    return new Promise<MatchState>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      w.postMessage({ id, state, inputs });
    });
  }

  /** Cantidad de workers activos actualmente en el pool. */
  get activeWorkers(): number {
    return this.workers.filter(Boolean).length;
  }

  private getWorker(roomKey: string): Worker {
    const idx = this.hashKey(roomKey) % this.size;
    const existing = this.workers[idx];
    if (existing) return existing;

    const simUrl = new URL('../src/shared/sim.ts', import.meta.url).href;
    const workerCode = `
      (async () => {
        const { parentPort, workerData } = await import('node:worker_threads');
        try {
          const tsx = await import('tsx/esm/api');
          if (typeof tsx.register === 'function') tsx.register();
        } catch {
          // Si tsx ya está registrado en el proceso o se ejecuta JS compilado, continuar.
        }
        const { step } = await import(workerData.simUrl);
        parentPort.on('message', (msg) => {
          try {
            step(msg.state, msg.inputs);
            parentPort.postMessage({ id: msg.id, state: msg.state });
          } catch (err) {
            parentPort.postMessage({ id: msg.id, error: err instanceof Error ? err.message : String(err) });
          }
        });
      })().catch((err) => {
        console.error('simWorker_boot_error', err);
        process.exit(1);
      });
    `;

    const w = new Worker(workerCode, {
      eval: true,
      workerData: { simUrl },
    });

    w.on('message', (msg: { id: number; state?: MatchState; error?: string }) => {
      const job = this.pending.get(msg.id);
      if (!job) return;
      this.pending.delete(msg.id);
      if (msg.error) job.reject(new Error(msg.error));
      else job.resolve(msg.state!);
    });

    w.on('error', (err) => {
      for (const [id, job] of this.pending) {
        this.pending.delete(id);
        job.reject(err);
      }
      if (this.workers[idx] === w) this.workers[idx] = undefined as unknown as Worker;
    });

    this.workers[idx] = w;
    return w;
  }

  private hashKey(key: string): number {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /** Cierra todos los Worker Threads activos del pool. */
  async close(): Promise<void> {
    this.closed = true;
    for (const [id, job] of this.pending) {
      this.pending.delete(id);
      job.reject(new Error('SimWorkerPool cerrado'));
    }
    const list = this.workers.filter(Boolean);
    this.workers = [];
    await Promise.all(list.map((w) => w.terminate().catch(() => 0)));
  }
}
