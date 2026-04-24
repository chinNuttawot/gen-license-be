/**
 * licenseController.ts
 *
 * POST /api/license/generate
 *
 * account-based : quantity N  → N tokens, hwid = null in each
 * station-based : hwids[]     → one token per HWID entry (quantity = hwids.length)
 */
import { Request, Response } from 'express';
import { createPrivateKey, sign, KeyObject } from 'crypto';
import { AppDataSource } from '../config/database.config';
import { Company } from '../entities/Company.entity';
import { LicenseRecord } from '../entities/LicenseRecord.entity';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { encryptToken } from '../utils/bundleCrypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type LicenseType = 'account-based' | 'station-based';

export interface LicenseRequestBody {
  company: string;
  licenseType: LicenseType;
  /** account-based: number of seats. station-based: ignored (derived from hwids.length) */
  quantity: number;
  /** station-based only: one HWID per node */
  hwids?: string[];
  expiry: string;
}

export interface LicensePayload {
  company: string;
  licenseType: LicenseType;
  /** Always 1 — each token IS one license. */
  quantity: 1;
  index: number;
  hwid: string | null;
  expiry: string;
  issuedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function base64ToPkcs8Pem(raw: string): string {
  const cleaned = raw.replace(/\\n/g, '').replace(/\s/g, '');
  const body = cleaned.match(/.{1,64}/g)!.join('\n');
  return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
}

let _cachedKey: KeyObject | null = null;
function loadPrivateKey(): KeyObject {
  if (_cachedKey) return _cachedKey;
  const raw = process.env.PRIVATE_KEY ?? process.env.ANTIGRAVITY_PRIVATE_KEY;
  if (!raw) throw new Error('PRIVATE_KEY is not set in environment variables.');
  _cachedKey = createPrivateKey({ key: base64ToPkcs8Pem(raw), format: 'pem', type: 'pkcs8' });
  return _cachedKey;
}

function buildToken(payload: LicensePayload): string {
  const dataString = JSON.stringify(payload);
  const sigBuffer = sign(null, Buffer.from(dataString), loadPrivateKey());
  return Buffer.from(JSON.stringify({ data: dataString, signature: sigBuffer.toString('hex') })).toString('base64');
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------
export const generate = catchAsync(async (req: Request<{}, {}, LicenseRequestBody>, res: Response): Promise<Response | any> => {
  // Destructure validated body
  const { company, licenseType, quantity, hwids, expiry } = req.body;

  const issuedAt = new Date().toISOString();
  const expiryIso = new Date(expiry).toISOString();
  const companyName = company.trim();

  // -----------------------------------------------------------------------
  // Station-based: one token per HWID entry
  // -----------------------------------------------------------------------
  if (licenseType === 'station-based') {
    // hwids are already cleaned and validated by the middleware
    const cleanedHwids = hwids as string[];
    const total = cleanedHwids.length;
    const tokens = cleanedHwids.map((hwid, i) =>
      buildToken({ company: companyName, licenseType, quantity: 1, index: i + 1, hwid, expiry: expiryIso, issuedAt })
    );

    // Save to database
    try {
      const companyRepo = AppDataSource.getRepository(Company);
      const recordRepo = AppDataSource.getRepository(LicenseRecord);

      let companyEntity = await companyRepo.findOne({ where: { name: companyName } });
      if (!companyEntity) {
        companyEntity = companyRepo.create({ name: companyName });
        await companyRepo.save(companyEntity);
      }

      const records = cleanedHwids.map((hwid, i) =>
        recordRepo.create({
          companyId: companyEntity.id,
          licenseType,
          quantity: 1,
          hwid,
          validUntil: new Date(expiryIso),
          encryptedToken: encryptToken(tokens[i]),
        })
      );
      await recordRepo.save(records);
    } catch (dbErr) {
      console.error('[licenseController.generate] DB Save Error:', dbErr);
      // Continue and return tokens even if DB save fails
    }

    return res.json({
      tokens,
      meta: { company: companyName, licenseType, hwids: cleanedHwids, expiry: expiryIso, issuedAt },
    });
  }

  // -----------------------------------------------------------------------
  // Account-based: N tokens, no HWID
  // -----------------------------------------------------------------------
  // quantity is already validated and cast to Number by the middleware
  const total = quantity;

  const tokens = Array.from({ length: total }, (_, i) =>
    buildToken({ company: companyName, licenseType, quantity: 1, index: i + 1, hwid: null, expiry: expiryIso, issuedAt })
  );

  // Save to database
  try {
    const companyRepo = AppDataSource.getRepository(Company);
    const recordRepo = AppDataSource.getRepository(LicenseRecord);

    let companyEntity = await companyRepo.findOne({ where: { name: companyName } });
    if (!companyEntity) {
      companyEntity = companyRepo.create({ name: companyName });
      await companyRepo.save(companyEntity);
    }

    const records = tokens.map((token) =>
      recordRepo.create({
        companyId: companyEntity.id,
        licenseType,
        quantity: 1,
        hwid: null,
        validUntil: new Date(expiryIso),
        encryptedToken: encryptToken(token),
      })
    );
    await recordRepo.save(records);
  } catch (dbErr) {
    console.error('[licenseController.generate] DB Save Error:', dbErr);
    // Continue and return tokens even if DB save fails
  }

  res.json({
    tokens,
    meta: { company: companyName, licenseType, hwid: null, expiry: expiryIso, issuedAt },
  });
});
