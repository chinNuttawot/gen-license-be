import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

/** Helper to convert base64 PUBLIC_KEY to PEM format for Node.js crypto */
function loadPublicKey(raw: string): crypto.KeyObject {
  const cleaned = raw.replace(/\\n/g, '').replace(/\s/g, '');
  const body = (cleaned.match(/.{1,64}/g) || []).join('\n');
  const pem = `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----\n`;
  return crypto.createPublicKey({ key: pem, format: 'pem', type: 'spki' });
}

function decrypt(filePath: string) {
  const BUNDLE_KEY = process.env.BUNDLE_KEY;
  const PUBLIC_KEY_RAW = process.env.PUBLIC_KEY;
  
  if (!BUNDLE_KEY || !PUBLIC_KEY_RAW) {
    console.error('❌ Error: BUNDLE_KEY or PUBLIC_KEY not found in .env');
    return;
  }

  let publicKey: crypto.KeyObject;
  try {
    publicKey = loadPublicKey(PUBLIC_KEY_RAW);
  } catch (err) {
    console.error('❌ Error: Failed to load PUBLIC_KEY. Make sure it is a valid Base64 SPKI key.');
    return;
  }

  const key = Buffer.from(BUNDLE_KEY, 'base64');
  
  let envelopeJson;
  try {
    const rawFile = fs.readFileSync(filePath, 'utf8').trim();
    envelopeJson = Buffer.from(rawFile, 'base64').toString('utf8');
  } catch (err) {
    console.error('❌ Error: Could not read or decode .aglic file structure.');
    return;
  }

  const envelope = JSON.parse(envelopeJson);
  if (envelope.v !== 1 || envelope.alg !== 'AES-GCM-256') {
    console.error('❌ Error: Unsupported bundle format');
    return;
  }

  const iv = Buffer.from(envelope.iv, 'base64');
  const tag = Buffer.from(envelope.tag, 'base64');
  const ciphertext = Buffer.from(envelope.data, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  let bundle;
  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    bundle = JSON.parse(decrypted.toString());
    console.log('✅ Bundle Decrypted Successfully');
  } catch (err) {
    console.error('❌ Decryption failed. BUNDLE_KEY is likely incorrect.');
    return;
  }

  console.log('── Meta Data ────────────────');
  console.log(JSON.stringify(bundle.meta, null, 2));
    
  console.log('\n── Tokens Verification (using PUBLIC_KEY) ──');
  bundle.tokens.forEach((t: string, i: number) => {
    try {
      const decoded = JSON.parse(Buffer.from(t, 'base64').toString('utf8'));
      
      // Verify Signature using PUBLIC_KEY object
      const isVerified = crypto.verify(
        undefined, 
        Buffer.from(decoded.data),
        publicKey,
        Buffer.from(decoded.signature, 'hex')
      );

      console.log(`Token ${i + 1}: ${isVerified ? '✅ VERIFIED' : '❌ INVALID SIGNATURE'}`);
      console.log(`   Data: ${decoded.data}`);
    } catch (err) {
      console.log(`Token ${i + 1}: ❌ ERROR - ${(err as Error).message}`);
    }
  });
}

const targetFile = process.argv[2];
if (!targetFile) {
  console.error('Usage: npx ts-node --transpile-only decrypt.ts <path_to_aglic_file>');
} else {
  decrypt(targetFile);
}
