// ============================================================================
// EcoRoute AI — Provider Key Encryption & Masking Utility (AES-256-GCM)
// ============================================================================

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Derives a 32-byte key from the environment master key
 */
function getMasterKey(): Buffer {
  const secret = process.env.PROVIDER_ENCRYPTION_KEY || 'ecoroute-production-encryption-secret-key-32chars';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plaintext secret into an iv:tag:ciphertext format
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext || plaintext.trim().length === 0) return '';
  
  // If already encrypted, don't re-encrypt
  if (plaintext.startsWith('enc:')) {
    return plaintext;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getMasterKey(), iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an encrypted secret back into plaintext.
 * Gracefully handles unencrypted legacy keys.
 */
export function decryptSecret(ciphertext: string): string {
  if (!ciphertext || ciphertext.trim().length === 0) return '';
  
  // Not encrypted with our scheme, return as is (backwards compatibility)
  if (!ciphertext.startsWith('enc:')) {
    return ciphertext;
  }

  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 4) return '';

    const iv = Buffer.from(parts[1]!, 'hex');
    const tag = Buffer.from(parts[2]!, 'hex');
    const encryptedHex = parts[3]!;

    const decipher = crypto.createDecipheriv(ALGORITHM, getMasterKey(), iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[EcoRoute Crypto] Failed to decrypt secret:', (err as Error).message);
    return '';
  }
}

/**
 * Returns a masked representation of an API key (e.g. "••••••••1234")
 * Never reveals the full secret.
 */
export function maskApiKey(apiKey?: string | null): string {
  if (!apiKey || apiKey.trim().length === 0) return '';
  const clear = decryptSecret(apiKey);
  if (!clear || clear.length < 4) return '••••••••';
  const last4 = clear.slice(-4);
  return `••••••••${last4}`;
}
