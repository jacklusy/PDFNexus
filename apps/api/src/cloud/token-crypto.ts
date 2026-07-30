import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const PREFIX = 'enc:v1:';

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

/** Encrypt plaintext with AES-256-GCM. Returns `enc:v1:<iv_b64>:<tag_b64>:<ct_b64>`. */
export function encryptToken(plaintext: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptToken(payload: string, secret: string): string {
  if (!payload.startsWith(PREFIX)) {
    return payload;
  }
  const rest = payload.slice(PREFIX.length);
  const [ivB64, tagB64, ctB64] = rest.split(':');
  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error('Invalid encrypted token payload');
  }
  const key = deriveKey(secret);
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function isEncryptedPayload(payload: string): boolean {
  return payload.startsWith(PREFIX);
}
