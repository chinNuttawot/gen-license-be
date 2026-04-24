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
export const generate = (req: Request<{}, {}, LicenseRequestBody>, res: Response): Response => {
  try {
    const { company, licenseType, quantity, hwids, expiry } = req.body;

    // Validation — company
    if (!company || typeof company !== 'string' || !company.trim()) {
      return res.status(400).json({ error: 'company is required.' });
    }

    // Validation — licenseType
    if (!(['account-based', 'station-based'] as const).includes(licenseType)) {
      return res.status(400).json({ error: 'licenseType must be "account-based" or "station-based".' });
    }

    // Validation — expiry
    if (!expiry || isNaN(Date.parse(expiry))) {
      return res.status(400).json({ error: 'expiry must be a valid ISO date string (yyyy-mm-dd).' });
    }
    if (new Date(expiry).getTime() <= Date.now()) {
      return res.status(400).json({ error: 'expiry must be a future date.' });
    }

    const issuedAt = new Date().toISOString();
    const expiryIso = new Date(expiry).toISOString();
    const companyName = company.trim();

    // -----------------------------------------------------------------------
    // Station-based: one token per HWID entry
    // -----------------------------------------------------------------------
    if (licenseType === 'station-based') {
      if (!Array.isArray(hwids) || hwids.length === 0) {
        return res.status(400).json({ error: 'hwids[] is required for station-based licenses.' });
      }
      const cleanedHwids = hwids.map((h) => h.trim());
      if (cleanedHwids.some((h) => !h)) {
        return res.status(400).json({ error: 'All hardware IDs must be non-empty strings.' });
      }
      const uniqueHwids = new Set(cleanedHwids);
      if (uniqueHwids.size !== cleanedHwids.length) {
        return res.status(400).json({ error: 'Duplicate hardware IDs are not allowed.' });
      }

      const total = cleanedHwids.length;
      const tokens = cleanedHwids.map((hwid, i) =>
        buildToken({ company: companyName, licenseType, quantity: 1, index: i + 1, hwid, expiry: expiryIso, issuedAt })
      );

      return res.json({
        tokens,
        meta: { company: companyName, licenseType, hwids: cleanedHwids, expiry: expiryIso, issuedAt },
      });
    }

    // -----------------------------------------------------------------------
    // Account-based: N tokens, no HWID
    // -----------------------------------------------------------------------
    const total = Number(quantity);
    if (!Number.isInteger(total) || total < 1) {
      return res.status(400).json({ error: 'quantity must be a positive integer (minimum 1).' });
    }

    const tokens = Array.from({ length: total }, (_, i) =>
      buildToken({ company: companyName, licenseType, quantity: 1, index: i + 1, hwid: null, expiry: expiryIso, issuedAt })
    );

    return res.json({
      tokens,
      meta: { company: companyName, licenseType, hwid: null, expiry: expiryIso, issuedAt },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[licenseController.generate]', message);
    return res.status(500).json({ error: message });
  }
};
