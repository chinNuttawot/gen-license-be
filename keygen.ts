#!/usr/bin/env tsx
/**
 * keygen.ts — One-time Key Generator
 * Generates: Ed25519 signing keys + AES-256-GCM bundle key
 * Usage: npm run keygen
 */
import { generateKeyPairSync, randomBytes } from 'crypto';

// ── Ed25519 signing pair ─────────────────────────────────────
const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const toBase64 = (pem: string): string =>
  pem
    .split('\n')
    .filter((l) => l && !l.startsWith('-----'))
    .join('');

// ── AES-256-GCM bundle key (32 random bytes) ─────────────────
const bundleKey = randomBytes(32).toString('base64');

// ── Output ───────────────────────────────────────────────────
console.log('\n=== Generate License — One-time Key Setup ===\n');

console.log('── Backend (.env) ───────────────────────────');
console.log(`PRIVATE_KEY=${toBase64(privateKey)}`);
console.log(`PUBLIC_KEY=${toBase64(publicKey)}`);
console.log(`BUNDLE_KEY=${bundleKey}`);

console.log('\n── Distribute to users (once) ───────────────');
console.log(`PUBLIC_KEY=${toBase64(publicKey)}`);
console.log(`BUNDLE_KEY=${bundleKey}`);
console.log('\n  · PUBLIC_KEY  → verify individual license tokens');
console.log('  · BUNDLE_KEY  → decrypt exported .aglic bundle files\n');
