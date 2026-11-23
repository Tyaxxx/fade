import type { FadeParams, RenderedImage } from '../../core/index';
import type { ExportEncoding } from '../lib/exportFormat';
import type { RenderRequest, RenderResponse } from './protocol';

/** The app's only way to get pixels. Swappable (tests inject a fake). */
export interface Renderer {
  /** Latest-wins preview render: superseded requests are skipped. `onError` gets a short reason on failure. */
  renderPreview(params: FadeParams, scale: number, onImage: (image: RenderedImage) => void, onError?: (message: string) => void): void;
  /** Full-resolution image encoded as `encoding` (JPEG or PNG), rendered in its own worker so the preview stays live. */
  exportImage(params: FadeParams, encoding: ExportEncoding): Promise<Blob>;
  dispose(): void;
}

/** The parts of a Worker the renderer uses. Real workers and test fakes both fit. */
export type WorkerLike = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'>;

const defaultSpawn = (): WorkerLike => new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module' });

export const CRASH_ERROR = 'The export ran out of memory or crashed. Try a smaller size.';
const PREVIEW_CRASH_ERROR = 'The preview renderer crashed.';
export const DEAD_ERROR = 'The renderer couldn’t start. Reload the page.';
/** Crashes before a lane's first successful reply after which it gives up respawning. Once a lane has worked, it always respawns. */
const MAX_CRASHES = 3;

type Job = { req: RenderRequest; resolve: (r: RenderResponse) => void };

/** Serial job runner over one worker that respawns the worker if it crashes. */
function createLane(spawn: () => WorkerLike, crashError: string) {
  let nextId = 1;
  let busy = false;
  let current: Job | undefined;
  let crashes = 0;
  let succeeded = false;
  let dead = false;
  let pickNext: () => Job | undefined = () => undefined;
  let worker = start();

  function start(): WorkerLike {
    const w = spawn();
    w.onmessage = (event: MessageEvent<RenderResponse>) => {
      if (!current || event.data.id !== current.req.id) return;
      const job = current;
      current = undefined;
      busy = false;
      succeeded = true;
      job.resolve(event.data);
      pump();
    };
    w.onerror = (event: ErrorEvent) => {
      event.preventDefault();
      fail(crashError);
    };
    w.onmessageerror = () => fail(crashError);
    return w;
  }

  function fail(error: string) {
    const job = current;
    current = undefined;
    busy = false;
    worker.terminate();
    crashes += 1;
    if (!succeeded && crashes >= MAX_CRASHES) dead = true;
    else worker = start();
    job?.resolve({ id: job.req.id, ok: false, error });
    pump();
  }

  function pump() {
    if (busy) return;
    const job = pickNext();
    if (!job) return;
    if (dead) {
      job.resolve({ id: job.req.id, ok: false, error: DEAD_ERROR });
      pump();
      return;
    }
    busy = true;
    current = job;
    worker.postMessage(job.req);
  }

  return {
    id: () => nextId++,
    setScheduler(fn: () => Job | undefined) {
      pickNext = fn;
    },
    pump,
    terminate: () => worker.terminate(),
  };
}

export function createRenderer(spawn: () => WorkerLike = defaultSpawn): Renderer {
  const previewLane = createLane(spawn, PREVIEW_CRASH_ERROR);
  const exportLane = createLane(spawn, CRASH_ERROR);

  // Preview lane: only the newest pending preview is kept.
  let pendingPreview: Job | undefined;
  previewLane.setScheduler(() => {
    const job = pendingPreview;
    pendingPreview = undefined;
    return job;
  });

  const exportQueue: Job[] = [];
  exportLane.setScheduler(() => exportQueue.shift());

  return {
    renderPreview(params, scale, onImage, onError) {
      pendingPreview = {
        req: { id: previewLane.id(), kind: 'image', params, scale },
        resolve: (r) => {
          if (r.ok && r.kind === 'image') onImage(r.image);
          else onError?.(r.ok ? 'Unexpected reply' : r.error);
        },
      };
      previewLane.pump();
    },

    exportImage(params, encoding) {
      return new Promise<Blob>((resolve, reject) => {
        exportQueue.push({
          req: { id: exportLane.id(), kind: 'export', params, encoding },
          resolve: (r) => (r.ok && r.kind === 'export' ? resolve(r.blob) : reject(new Error(r.ok ? 'Unexpected reply' : r.error))),
        });
        exportLane.pump();
      });
    },

    dispose() {
      previewLane.terminate();
      exportLane.terminate();
    },
  };
}

let shared: Renderer | undefined;
/** One renderer per page load (avoids duplicate workers under StrictMode). */
export function getSharedRenderer(): Renderer {
  shared ??= createRenderer();
  return shared;
}
