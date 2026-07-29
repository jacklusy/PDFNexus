import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const CONVERT_PATH = '/forms/libreoffice/convert';
const DEFAULT_TIMEOUT_MS = 120_000;

@Injectable()
export class ConversionsService {
  private readonly logger = new Logger(ConversionsService.name);

  constructor(private readonly config: ConfigService) {}

  getGotenbergBaseUrl(): string {
    const raw =
      this.config.get<string>('GOTENBERG_URL')?.trim() ||
      'http://localhost:3001';
    return raw.replace(/\/$/, '');
  }

  /**
   * Proxy an Office document to Gotenberg's LibreOffice convert endpoint.
   * Returns raw PDF bytes. Does not log file contents.
   */
  async officeToPdf(
    fileBuffer: Buffer,
    filename: string,
  ): Promise<Buffer> {
    const base = this.getGotenbergBaseUrl();
    const url = `${base}${CONVERT_PATH}`;

    const form = new FormData();
    // Uint8Array avoids TS Buffer→Blob friction across Node typings.
    const bytes = new Uint8Array(fileBuffer);
    form.append(
      'files',
      new Blob([bytes], { type: 'application/octet-stream' }),
      filename,
    );

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Gotenberg unreachable: ${message}`);
      throw new ServiceUnavailableException({
        error:
          'Conversion service is unavailable. Ensure Gotenberg is running.',
        code: 'CONVERSION_UNAVAILABLE',
      });
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger.error(
        `Gotenberg convert failed status=${response.status} detail=${detail.slice(0, 200)}`,
      );
      throw new BadGatewayException({
        error: 'Office conversion failed. Check that the file is a valid Office document.',
        code: 'CONVERSION_FAILED',
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
