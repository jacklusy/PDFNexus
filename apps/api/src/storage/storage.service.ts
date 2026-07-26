import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';

export interface StoredPart {
  partNumber: number;
  etag: string;
  sizeBytes: number;
}

/**
 * RFC 6266 Content-Disposition with an ASCII fallback plus UTF-8 `filename*`,
 * so downloads keep the original name instead of the opaque storage key.
 */
function contentDispositionHeader(
  fileName: string,
  disposition: 'attachment' | 'inline',
): string {
  const asciiFallback = fileName
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '');
  const encoded = encodeURIComponent(fileName);
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client!: S3Client;
  private bucket!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const endpoint = this.config.getOrThrow<string>('S3_ENDPOINT');
    const region = this.config.get<string>('S3_REGION') ?? 'us-east-1';
    const forcePathStyle =
      this.config.get<boolean>('S3_FORCE_PATH_STYLE') !== false;

    this.bucket = this.config.getOrThrow<string>('S3_BUCKET');
    this.client = new S3Client({
      endpoint,
      region,
      forcePathStyle,
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: this.config.getOrThrow<string>('S3_SECRET_KEY'),
      },
    });
    this.logger.log(`S3 client ready (bucket=${this.bucket})`);
  }

  async putObject(
    key: string,
    body: Buffer | Readable | string,
    contentType: string,
    contentLength?: number,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ...(typeof contentLength === 'number'
          ? { ContentLength: contentLength }
          : {}),
      }),
    );
  }

  /** Stream a local file to S3, then delete the temp path. */
  async putObjectFromFile(
    key: string,
    filePath: string,
    contentType: string,
    contentLength: number,
  ): Promise<void> {
    const { createReadStream } = await import('fs');
    const { unlink } = await import('fs/promises');
    const stream = createReadStream(filePath);
    try {
      await this.putObject(key, stream, contentType, contentLength);
    } finally {
      await unlink(filePath).catch(() => {
        // ignore cleanup failures
      });
    }
  }

  async getObject(key: string): Promise<{
    body: Readable;
    contentType?: string;
    contentLength?: number;
  }> {
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
    return {
      body: result.Body as Readable,
      contentType: result.ContentType,
      contentLength: result.ContentLength,
    };
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async presignGet(
    key: string,
    expiresInSec = 900,
    options?: {
      fileName?: string;
      contentType?: string;
      disposition?: 'attachment' | 'inline';
    },
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ...(options?.contentType
        ? { ResponseContentType: options.contentType }
        : {}),
      ...(options?.fileName
        ? {
            ResponseContentDisposition: contentDispositionHeader(
              options.fileName,
              options.disposition ?? 'attachment',
            ),
          }
        : {}),
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSec });
  }

  async presignPut(
    key: string,
    contentType: string,
    expiresInSec = 900,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSec });
  }

  // ---------------------------------------------------------------------
  // Multipart upload primitives (direct-to-storage uploads)
  // ---------------------------------------------------------------------

  async createMultipartUpload(
    key: string,
    contentType: string,
  ): Promise<string> {
    const result = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
    );
    if (!result.UploadId) {
      throw new Error('Storage did not return a multipart UploadId');
    }
    return result.UploadId;
  }

  async presignUploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    expiresInSec = 900,
  ): Promise<string> {
    const command = new UploadPartCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSec });
  }

  /** Authoritative list of uploaded parts, paginated past the 1000-part page size. */
  async listParts(key: string, uploadId: string): Promise<StoredPart[]> {
    const parts: StoredPart[] = [];
    let marker: string | undefined;
    do {
      const result = await this.client.send(
        new ListPartsCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
          PartNumberMarker: marker,
        }),
      );
      for (const part of result.Parts ?? []) {
        if (part.PartNumber && part.ETag) {
          parts.push({
            partNumber: part.PartNumber,
            etag: part.ETag,
            sizeBytes: part.Size ?? 0,
          });
        }
      }
      marker = result.IsTruncated
        ? result.NextPartNumberMarker
        : undefined;
    } while (marker);
    return parts;
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>,
  ): Promise<void> {
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts
            .slice()
            .sort((a, b) => a.partNumber - b.partNumber)
            .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
        },
      }),
    );
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await this.client.send(
      new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
      }),
    );
  }

  async headObject(
    key: string,
  ): Promise<{ contentLength: number; contentType?: string } | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        contentLength: result.ContentLength ?? 0,
        contentType: result.ContentType,
      };
    } catch {
      return null;
    }
  }

  /** Read a small byte range (e.g. for magic-byte validation). */
  async getObjectRange(
    key: string,
    start: number,
    endInclusive: number,
  ): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Range: `bytes=${start}-${endInclusive}`,
      }),
    );
    const body = result.Body;
    if (!body) return Buffer.alloc(0);
    const chunks: Buffer[] = [];
    for await (const chunk of body as Readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
