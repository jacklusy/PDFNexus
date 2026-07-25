import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Type, type Schema } from '@google/genai';

export const layoutResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Overall document or page title if present' },
    elements: {
      type: Type.ARRAY,
      description: 'Ordered list of document elements on this page',
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            description: "Element type: 'heading', 'paragraph', 'table', 'list', or 'callout'",
          },
          headingLevel: {
            type: Type.INTEGER,
            description: 'Heading level 1 to 4 (for headings)',
          },
          text: { type: Type.STRING, description: 'Main text content' },
          bold: { type: Type.BOOLEAN },
          italic: { type: Type.BOOLEAN },
          fontSizePt: { type: Type.NUMBER, description: 'Font size in pt' },
          textColorHex: { type: Type.STRING, description: 'Color hex code' },
          alignment: { type: Type.STRING, description: 'left, center, right, or justify' },
          listItems: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Items if type is 'list'",
          },
          tableRows: {
            type: Type.ARRAY,
            description: "Rows if type is 'table'",
            items: {
              type: Type.OBJECT,
              properties: {
                cells: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING },
                      isHeader: { type: Type.BOOLEAN },
                      bold: { type: Type.BOOLEAN },
                      bgHex: { type: Type.STRING },
                    },
                  },
                },
              },
            },
          },
        },
        required: ['type'],
      },
    },
  },
  required: ['elements'],
};

export type OcrValidationResult =
  | { ok: true; cleanBase64: string; pageNumber: number; mimeType: string }
  | { ok: false; status: number; code: string; error: string };

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private aiClient: GoogleGenAI | null = null;

  constructor(private readonly config: ConfigService) {}

  getGeminiKey(): string | null {
    const raw = this.config.get<string>('GEMINI_API_KEY')?.trim() ?? '';
    if (!raw || raw === 'MY_GEMINI_API_KEY') return null;
    return raw;
  }

  private getAIClient(): GoogleGenAI | null {
    const key = this.getGeminiKey();
    if (!key) return null;
    if (!this.aiClient) {
      this.aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: { 'User-Agent': 'pdfnexus-api' },
        },
      });
    }
    return this.aiClient;
  }

  validateBody(body: unknown, maxBase64Chars: number): OcrValidationResult {
    if (!body || typeof body !== 'object') {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_BODY',
        error: 'Request body must be JSON',
      };
    }

    const { imageBase64, pageNumber, mimeType: bodyMime } = body as {
      imageBase64?: unknown;
      pageNumber?: unknown;
      mimeType?: unknown;
    };

    if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
      return {
        ok: false,
        status: 400,
        code: 'MISSING_IMAGE',
        error: 'Missing imageBase64 parameter',
      };
    }

    if (imageBase64.length > maxBase64Chars) {
      return {
        ok: false,
        status: 413,
        code: 'PAYLOAD_TOO_LARGE',
        error: 'Page image exceeds maximum allowed size',
      };
    }

    const dataUrlMatch = imageBase64.match(
      /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i,
    );
    let mimeType = 'image/jpeg';
    let cleanBase64 = imageBase64;

    if (dataUrlMatch) {
      const subtype = dataUrlMatch[1].toLowerCase();
      mimeType = subtype === 'jpg' ? 'image/jpeg' : `image/${subtype}`;
      cleanBase64 = dataUrlMatch[2];
    } else if (/^data:/i.test(imageBase64)) {
      return {
        ok: false,
        status: 400,
        code: 'UNSUPPORTED_MIME',
        error: 'Only PNG, JPEG, or WEBP page images are accepted',
      };
    } else if (
      typeof bodyMime === 'string' &&
      ['image/jpeg', 'image/png', 'image/webp'].includes(bodyMime)
    ) {
      mimeType = bodyMime;
    }

    if (!/^[A-Za-z0-9+/=\s]+$/.test(cleanBase64)) {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_BASE64',
        error: 'imageBase64 is not valid base64',
      };
    }

    let page = 1;
    if (pageNumber !== undefined && pageNumber !== null) {
      const n = Number(pageNumber);
      if (!Number.isInteger(n) || n < 1 || n > 100_000) {
        return {
          ok: false,
          status: 400,
          code: 'INVALID_PAGE',
          error: 'pageNumber must be a positive integer',
        };
      }
      page = n;
    }

    return { ok: true, cleanBase64, pageNumber: page, mimeType };
  }

  async analyze(
    cleanBase64: string,
    mimeType: string,
    pageNumber: number,
  ): Promise<{ success: true; pageNumber: number; layout: unknown }> {
    const ai = this.getAIClient();
    if (!ai) {
      const err = new Error('OCR is not configured on this server.');
      (err as Error & { code: string; status: number }).code = 'AI_UNAVAILABLE';
      (err as Error & { status: number }).status = 503;
      throw err;
    }

    const timeoutMs = this.config.get<number>('OCR_TIMEOUT_MS') ?? 45_000;
    const prompt = `Analyze this PDF page image (Page ${pageNumber}) for document conversion to Word (.docx).
Perform high-precision OCR and structural layout analysis.
Identify and preserve:
1. Headings (with level 1-4, approximate font size in pt, bold/color/alignment)
2. Paragraphs (with formatting: bold, italic, font size, text color, alignment)
3. Bulleted or numbered lists
4. Tables (extract exact rows and cells, headers, text inside cells, and background colors)
5. Callout boxes or quotes

Return a valid structured JSON matching the schema with every paragraph, heading, list item, and table accurately extracted verbatim.`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              { text: prompt },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: layoutResponseSchema,
          temperature: 0.1,
        },
      }),
      timeoutMs,
      'OCR',
    );

    const responseText = response.text || '{}';
    let layoutData: unknown;
    try {
      layoutData = JSON.parse(responseText);
    } catch {
      const err = new Error('OCR returned invalid JSON');
      (err as Error & { code: string; status: number }).code =
        'OCR_INVALID_RESPONSE';
      (err as Error & { status: number }).status = 502;
      throw err;
    }

    return {
      success: true,
      pageNumber,
      layout: layoutData,
    };
  }

  safeLog(err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(message);
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = 'Operation',
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${ms}ms`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
