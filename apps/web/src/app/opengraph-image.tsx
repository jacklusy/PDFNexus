import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 72,
          background:
            'linear-gradient(165deg, #0b1f24 0%, #12333a 42%, #1a4548 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 28,
            letterSpacing: 4,
            textTransform: 'uppercase',
            color: '#99f6e4',
            fontWeight: 700,
          }}
        >
          PDFNexus
        </div>
        {/* Site-wide card: every tool page shares this image, so the headline
            stays generic rather than naming one specific tool. */}
        <div style={{ marginTop: 24, fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>
          Edit & convert PDFs locally
        </div>
        <div style={{ marginTop: 20, fontSize: 28, color: 'rgba(255,255,255,0.8)', maxWidth: 800 }}>
          Browser-local editing. Verified delivery when you download.
        </div>
      </div>
    ),
    { ...size },
  );
}
