import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALG = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

/** Load and validate the BUNDLE_KEY from env (must be 32-byte base64 value) */
function loadBundleKey(): Buffer {
  const raw = process.env.BUNDLE_KEY;
  if (!raw) throw new Error('BUNDLE_KEY is not set in environment variables.');
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) throw new Error(`BUNDLE_KEY must decode to exactly 32 bytes (got ${buf.length}).`);
  return buf;
}

export interface BundleEnvelope {
  v: 1;
  alg: 'AES-GCM-256';
  iv: string;   // base64 12-byte IV
  tag: string;  // base64 16-byte auth tag
  data: string; // base64 ciphertext
}

/**
 * Encrypt arbitrary JSON payload with the fixed BUNDLE_KEY.
 * Returns base64-encoded JSON envelope (content of the .aglic file).
 */
export function encryptBundle(payload: object): string {
  const key = loadBundleKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);

  const plain = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();

  const envelope: BundleEnvelope = {
    v: 1,
    alg: 'AES-GCM-256',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  };

  return Buffer.from(JSON.stringify(envelope)).toString('base64');
}

/**
 * Decrypt a .aglic file content back to the original payload.
 * bundleKeyB64 — the BUNDLE_KEY (base64) coming from the requesting client.
 */
export function decryptBundle(fileContent: string, bundleKeyB64: string): object {
  const key = Buffer.from(bundleKeyB64, 'base64');
  if (key.length !== 32) throw new Error('Invalid bundle key length.');

  const envelope: BundleEnvelope = JSON.parse(
    Buffer.from(fileContent, 'base64').toString('utf8')
  );
  if (envelope.v !== 1 || envelope.alg !== 'AES-GCM-256') {
    throw new Error('Unsupported bundle format.');
  }

  const iv = Buffer.from(envelope.iv, 'base64');
  const tag = Buffer.from(envelope.tag, 'base64');
  const ciphertext = Buffer.from(envelope.data, 'base64');

  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);

  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plain.toString('utf8'));
}
