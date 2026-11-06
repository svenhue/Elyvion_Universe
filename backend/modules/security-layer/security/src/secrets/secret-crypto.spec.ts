import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decryptSecretValue, encryptSecretValue } from './secret-crypto';

describe('secret encryption', () => {
  let directory = '';
  const previousKeysFile = process.env.SECRET_STORE_KEYS_FILE;
  const previousActiveVersion = process.env.SECRET_STORE_ACTIVE_KEY_VERSION;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'elyvion-secret-test-'));
    process.env.SECRET_STORE_KEYS_FILE = join(directory, 'keys.json');
    process.env.SECRET_STORE_ACTIVE_KEY_VERSION = 'v1';
    await writeKeyRing({ v1: Buffer.alloc(32, 7).toString('base64') });
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
    restoreEnvironment('SECRET_STORE_KEYS_FILE', previousKeysFile);
    restoreEnvironment('SECRET_STORE_ACTIVE_KEY_VERSION', previousActiveVersion);
  });

  it('stores ciphertext instead of plaintext and can decrypt with the mounted key', async () => {
    const plaintext = 'integration-password-that-must-not-be-stored';

    const encrypted = await encryptSecretValue(plaintext);

    expect(encrypted.ciphertext).not.toContain(plaintext);
    expect(JSON.stringify(encrypted)).not.toContain(plaintext);
    await expect(decryptSecretValue(encrypted)).resolves.toBe(plaintext);
  });

  it('keeps old key versions available for decryption after key rotation', async () => {
    const encrypted = await encryptSecretValue('rotatable-secret');
    process.env.SECRET_STORE_ACTIVE_KEY_VERSION = 'v2';
    await writeKeyRing({
      v1: Buffer.alloc(32, 7).toString('base64'),
      v2: Buffer.alloc(32, 9).toString('base64'),
    });

    const rotated = await encryptSecretValue('new-secret');

    expect(rotated.keyVersion).toBe('v2');
    await expect(decryptSecretValue(encrypted)).resolves.toBe('rotatable-secret');
    await expect(decryptSecretValue(rotated)).resolves.toBe('new-secret');
  });

  async function writeKeyRing(keys: Record<string, string>): Promise<void> {
    await writeFile(process.env.SECRET_STORE_KEYS_FILE!, JSON.stringify(keys), { mode: 0o600 });
  }
});

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
