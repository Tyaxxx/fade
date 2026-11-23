import { generate } from '../../core/index';
import type { RenderRequest, RenderResponse } from './protocol';

// Minimal view of the dedicated-worker global (the app tsconfig uses the DOM lib).
const ctx = self as unknown as {
  postMessage(message: RenderResponse, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<RenderRequest>) => void) | null;
};

async function handle(req: RenderRequest): Promise<void> {
  try {
    if (req.kind === 'image') {
      const image = generate(req.params, { scale: req.scale });
      ctx.postMessage({ id: req.id, ok: true, kind: 'image', image }, [image.data.buffer]);
      return;
    }
    const image = generate(req.params);
    const canvas = new OffscreenCanvas(image.width, image.height);
    const c2d = canvas.getContext('2d');
    if (!c2d) throw new Error('This browser cannot draw images in the background.');
    c2d.putImageData(new ImageData(image.data as Uint8ClampedArray<ArrayBuffer>, image.width, image.height), 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: req.quality });
    ctx.postMessage({ id: req.id, ok: true, kind: 'jpeg', blob });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    ctx.postMessage({
      id: req.id,
      ok: false,
      error:
        req.kind === 'jpeg'
          ? `Couldn't create the JPEG at ${req.params.width} × ${req.params.height} px. Try a smaller size. (${detail})`
          : detail,
    });
  }
}

ctx.onmessage = (event) => {
  void handle(event.data);
};
