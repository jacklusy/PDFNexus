import { ConfigService } from '@nestjs/config';

/**
 * Prefer CLOUD_TOKEN_ENCRYPTION_KEY; fall back to GOOGLE_TOKEN_ENCRYPTION_KEY
 * so existing Drive deployments keep working.
 */
export function resolveCloudTokenEncryptionKey(config: ConfigService): string {
  const cloud = (config.get<string>('CLOUD_TOKEN_ENCRYPTION_KEY') ?? '').trim();
  if (cloud) return cloud;
  return (config.get<string>('GOOGLE_TOKEN_ENCRYPTION_KEY') ?? '').trim();
}

export function isCloudTokenEncryptionConfigured(key: string): boolean {
  return key.length >= 32;
}
