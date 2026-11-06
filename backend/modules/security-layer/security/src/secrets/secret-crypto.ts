import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export interface EncryptedSecretValue {
  ciphertext: string;
  iv: string;
  authTag: string;
  wrappedDek: string;
  keyIv: string;
  keyAuthTag: string;
  algorithm: 'aes-256-gcm';
  keyVersion: string;
}

interface KeyRing {
  activeKeyVersion: string;
  keys: Record<string, Buffer>;
}

export async function encryptSecretValue(plaintext: string): Promise<EncryptedSecretValue> {
  const keyRing = await loadKeyRing();
  const dek = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', dek, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  const keyIv = randomBytes(12);
  const keyCipher = createCipheriv('aes-256-gcm', keyRing.keys[keyRing.activeKeyVersion], keyIv);
  const wrappedDek = Buffer.concat([keyCipher.update(dek), keyCipher.final()]);

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    wrappedDek: wrappedDek.toString('base64'),
    keyIv: keyIv.toString('base64'),
    keyAuthTag: keyCipher.getAuthTag().toString('base64'),
    algorithm: 'aes-256-gcm',
    keyVersion: keyRing.activeKeyVersion,
  };
}

export async function decryptSecretValue(value: EncryptedSecretValue): Promise<string> {
  const keyRing = await loadKeyRing();
  const key = keyRing.keys[value.keyVersion];
  if (!key) throw new ServiceUnavailableException('Secret encryption key version is unavailable.');

  try {
    const keyDecipher = createDecipheriv('aes-256-gcm', key, Buffer.from(value.keyIv, 'base64'));
    keyDecipher.setAuthTag(Buffer.from(value.keyAuthTag, 'base64'));
    const dek = Buffer.concat([
      keyDecipher.update(Buffer.from(value.wrappedDek, 'base64')),
      keyDecipher.final(),
    ]);

    const decipher = createDecipheriv('aes-256-gcm', dek, Buffer.from(value.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(value.authTag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(value.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new ServiceUnavailableException('Secret could not be decrypted.');
  }
}

async function loadKeyRing(): Promise<KeyRing> {
  const filePath = process.env.SECRET_STORE_KEYS_FILE;
  const activeKeyVersion = process.env.SECRET_STORE_ACTIVE_KEY_VERSION;
  if (!filePath || !activeKeyVersion) {
    throw new ServiceUnavailableException('Secret-store encryption keys are not configured.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    throw new ServiceUnavailableException('Secret-store encryption key file is unavailable or invalid.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ServiceUnavailableException('Secret-store encryption key file is invalid.');
  }

  const keys: Record<string, Buffer> = {};
  for (const [version, encoded] of Object.entries(parsed)) {
    if (typeof encoded !== 'string') {
      throw new ServiceUnavailableException('Secret-store encryption key file is invalid.');
    }
    const decoded = Buffer.from(encoded, 'base64');
    if (decoded.length !== 32) {
      throw new ServiceUnavailableException('Secret-store encryption keys must be 256-bit base64 values.');
    }
    keys[version] = decoded;
  }
  if (!keys[activeKeyVersion]) {
    throw new ServiceUnavailableException('Active secret-store encryption key version is unavailable.');
  }
  return { activeKeyVersion, keys };
}

export function validateSecretPlaintext(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64_000) {
    throw new BadRequestException('Secret value must be a non-empty string of at most 64000 characters.');
  }
  return value;
}
