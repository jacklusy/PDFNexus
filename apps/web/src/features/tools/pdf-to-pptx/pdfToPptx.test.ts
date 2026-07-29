import { describe, expect, it, vi } from 'vitest';

vi.mock('../pdf-to-images/pdfToImages', () => ({
  pdfToImages: vi.fn(async (opts: { pages: number[] }) => ({
    files: opts.pages.map((n) => ({
      fileName: `p${n}.png`,
      blob: new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }),
    })),
  })),
}));

vi.mock('pptxgenjs', () => {
  class MockPptx {
    slides: unknown[] = [];
    defineLayout() {}
    layout = '';
    author = '';
    title = '';
    addSlide() {
      const slide = { addImage: vi.fn() };
      this.slides.push(slide);
      return slide;
    }
    async write() {
      return new Blob([`slides:${this.slides.length}`], {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });
    }
  }
  return { default: MockPptx };
});

// Image constructor for dimension probe
class FakeImage {
  naturalWidth = 800;
  naturalHeight = 600;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_v: string) {
    queueMicrotask(() => this.onload?.());
  }
}

vi.stubGlobal('Image', FakeImage);
vi.stubGlobal('URL', {
  createObjectURL: () => 'blob:mock',
  revokeObjectURL: () => undefined,
});

describe('pdfToPptx', () => {
  it('creates one slide per page', async () => {
    const { pdfToPptx } = await import('./pdfToPptx');
    const blob = await pdfToPptx({
      bytes: new ArrayBuffer(8),
      pages: [1, 2, 3],
      scale: 1,
      baseName: 'demo',
    });
    const text = await blob.text();
    expect(text).toContain('slides:3');
  });
});
