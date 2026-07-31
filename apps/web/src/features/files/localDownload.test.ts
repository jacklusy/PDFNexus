import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadBlobLocally, createLocalExport, uint8ToBlob } from './localDownload';

vi.mock('@/lib/pdf/pdfHelpers', () => ({
  trackObjectUrl: (url: string) => url,
  revokeObjectUrl: () => {},
}));

describe('localDownload', () => {
  const click = vi.fn();
  let created: HTMLAnchorElement | null = null;

  beforeEach(() => {
    click.mockReset();
    created = null;
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: () => 'blob:local-test',
      revokeObjectURL: () => {},
    });
    vi.stubGlobal('window', {
      setTimeout: (fn: () => void, ms?: number) =>
        setTimeout(fn, ms) as unknown as number,
      clearTimeout: (id: number) => clearTimeout(id),
    });
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        const el = {
          tagName: tag,
          href: '',
          download: '',
          rel: '',
          click,
        } as unknown as HTMLAnchorElement;
        created = el;
        return el;
      },
      body: { appendChild: () => {}, removeChild: () => {} },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('triggers a browser download without calling fetch', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const url = downloadBlobLocally(new Blob(['pdf']), 'out.pdf');
    expect(url).toBe('blob:local-test');
    expect(click).toHaveBeenCalledTimes(1);
    expect(created?.download).toBe('out.pdf');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('creates a local export result', () => {
    const blob = new Blob(['x']);
    const result = createLocalExport(blob, 'a.pdf', 'pdf', 3);
    expect(result.fileName).toBe('a.pdf');
    expect(result.pageCount).toBe(3);
    expect(result.localBlobUrl).toBe('blob:local-test');
  });

  it('uint8ToBlob builds a typed Blob', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const blob = uint8ToBlob(bytes, 'application/pdf');
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBe(3);
  });
});
