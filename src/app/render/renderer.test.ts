// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PARAMS } from '../../core/index';
import type { RenderRequest, RenderResponse } from './protocol';
import { createRenderer, type WorkerLike } from './renderer';

class FakeWorker implements WorkerLike {
  posted: RenderRequest[] = [];
  terminated = false;
  onmessage: WorkerLike['onmessage'] = null;
  onerror: WorkerLike['onerror'] = null;
  onmessageerror: WorkerLike['onmessageerror'] = null;
  postMessage(message: RenderRequest) {
    this.posted.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  reply(data: RenderResponse) {
    this.onmessage?.call(this as unknown as Worker, new MessageEvent('message', { data }));
  }
  crash() {
    this.onerror?.call(this as unknown as Worker, new ErrorEvent('error', { message: 'boom', cancelable: true }));
  }
  badMessage() {
    this.onmessageerror?.call(this as unknown as Worker, new MessageEvent('messageerror'));
  }
}

/** Spawn seam that records every worker. Lane order: preview lane is created first, export lane second. */
function setup() {
  const workers: FakeWorker[] = [];
  const spawn = vi.fn(() => {
    const w = new FakeWorker();
    workers.push(w);
    return w;
  });
  const renderer = createRenderer(spawn);
  return { renderer, workers, spawn };
}

const last = (w: FakeWorker) => w.posted[w.posted.length - 1];
const image = { width: 1, height: 1, data: new Uint8ClampedArray(4) };

describe('createRenderer: exportImage', () => {
  it('posts a PNG export with no quality on the export lane and resolves with the blob', async () => {
    const { renderer, workers } = setup();
    const p = renderer.exportImage(DEFAULT_PARAMS, { format: 'png' });
    expect(workers[0].posted).toHaveLength(0);
    const req = last(workers[1]);
    expect(req).toMatchObject({ kind: 'export', params: DEFAULT_PARAMS });
    expect(req.kind === 'export' && req.encoding).toEqual({ format: 'png' });
    const blob = new Blob(['png'], { type: 'image/png' });
    workers[1].reply({ id: req.id, ok: true, kind: 'export', blob });
    await expect(p).resolves.toBe(blob);
  });

  it('carries the quality for a JPEG export', () => {
    const { renderer, workers } = setup();
    void renderer.exportImage(DEFAULT_PARAMS, { format: 'jpeg', quality: 0.7 });
    expect(last(workers[1])).toMatchObject({ kind: 'export', encoding: { format: 'jpeg', quality: 0.7 } });
  });
});

describe('createRenderer: export lane errors (R2)', () => {
  for (const kind of ['crash', 'badMessage'] as const) {
    it(`rejects the export, respawns the worker and keeps processing after ${kind}`, async () => {
      const { renderer, workers, spawn } = setup();
      const exportWorker = workers[1];
      const first = renderer.exportImage(DEFAULT_PARAMS, { format: 'jpeg', quality: 0.9 });
      expect(exportWorker.posted).toHaveLength(1);
      exportWorker[kind]();
      await expect(first).rejects.toThrow(/ran out of memory or crashed/);
      expect(exportWorker.terminated).toBe(true);
      expect(spawn).toHaveBeenCalledTimes(3);

      const fresh = workers[2];
      const second = renderer.exportImage(DEFAULT_PARAMS, { format: 'jpeg', quality: 0.9 });
      expect(fresh.posted).toHaveLength(1);
      const blob = new Blob(['x']);
      fresh.reply({ id: last(fresh).id, ok: true, kind: 'export', blob });
      await expect(second).resolves.toBe(blob);
    });
  }

  it('processes a queued export on the new worker after a crash', async () => {
    const { renderer, workers } = setup();
    const first = renderer.exportImage(DEFAULT_PARAMS, { format: 'jpeg', quality: 0.9 });
    const second = renderer.exportImage(DEFAULT_PARAMS, { format: 'jpeg', quality: 0.8 });
    workers[1].crash();
    await expect(first).rejects.toThrow();
    const fresh = workers[2];
    expect(fresh.posted).toHaveLength(1);
    const blob = new Blob(['y']);
    fresh.reply({ id: last(fresh).id, ok: true, kind: 'export', blob });
    await expect(second).resolves.toBe(blob);
  });

  it('keeps the worker’s own error message when it replies ok:false', async () => {
    const { renderer, workers } = setup();
    const p = renderer.exportImage(DEFAULT_PARAMS, { format: 'jpeg', quality: 0.9 });
    workers[1].reply({ id: last(workers[1]).id, ok: false, error: 'Too big.' });
    await expect(p).rejects.toThrow('Too big.');
  });

  it('stops respawning after repeated start-up failures', async () => {
    const { renderer, workers } = setup();
    for (let i = 0; i < 3; i++) {
      const p = renderer.exportImage(DEFAULT_PARAMS, { format: 'jpeg', quality: 0.9 });
      workers[workers.length - 1].crash();
      await expect(p).rejects.toThrow();
    }
    const count = workers.length;
    await expect(renderer.exportImage(DEFAULT_PARAMS, { format: 'jpeg', quality: 0.9 })).rejects.toThrow(/couldn’t start/);
    expect(workers.length).toBe(count);
  });
});

describe('createRenderer: preview errors (R3)', () => {
  it('calls onError, not onImage, when the worker replies ok:false', () => {
    const { renderer, workers } = setup();
    const onImage = vi.fn();
    const onError = vi.fn();
    renderer.renderPreview(DEFAULT_PARAMS, 0.1, onImage, onError);
    workers[0].reply({ id: last(workers[0]).id, ok: false, error: 'nope' });
    expect(onError).toHaveBeenCalledWith('nope');
    expect(onImage).not.toHaveBeenCalled();
  });

  it('calls onError when the worker crashes mid-preview, and the next preview still renders', () => {
    const { renderer, workers } = setup();
    const onError = vi.fn();
    renderer.renderPreview(DEFAULT_PARAMS, 0.1, vi.fn(), onError);
    workers[0].crash();
    expect(onError).toHaveBeenCalledTimes(1);

    const onImage = vi.fn();
    renderer.renderPreview(DEFAULT_PARAMS, 0.1, onImage, onError);
    const fresh = workers[2];
    fresh.reply({ id: last(fresh).id, ok: true, kind: 'image', image });
    expect(onImage).toHaveBeenCalledWith(image);
  });

  it('keeps respawning a lane that has worked once, however often it crashes later (R5)', () => {
    const { renderer, workers } = setup();
    renderer.renderPreview(DEFAULT_PARAMS, 0.1, vi.fn(), vi.fn());
    workers[0].reply({ id: last(workers[0]).id, ok: true, kind: 'image', image });
    let current = workers[0];
    for (let i = 0; i < 4; i++) {
      renderer.renderPreview(DEFAULT_PARAMS, 0.1, vi.fn(), vi.fn());
      current.crash();
      current = workers[workers.length - 1];
    }
    const onImage = vi.fn();
    const onError = vi.fn();
    renderer.renderPreview(DEFAULT_PARAMS, 0.1, onImage, onError);
    expect(current.posted).toHaveLength(1);
    current.reply({ id: last(current).id, ok: true, kind: 'image', image });
    expect(onImage).toHaveBeenCalledWith(image);
    expect(onError).not.toHaveBeenCalled();
  });
});
