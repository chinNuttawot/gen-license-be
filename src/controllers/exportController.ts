import { Request, Response } from 'express';
import { encryptBundle } from '../utils/bundleCrypto';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';

export interface ExportRequestBody {
  tokens: string[];
  meta: {
    company: string;
    licenseType: string;
    expiry: string;
    issuedAt: string;
    hwids?: string[];
  };
}

export const exportBundle = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { tokens, meta } = req.body as ExportRequestBody;

  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw new AppError(400, 'tokens array is required and must not be empty.');
  }
  if (!meta?.company || !meta?.expiry) {
    throw new AppError(400, 'meta.company and meta.expiry are required.');
  }

    const bundle = { version: 1, meta, tokens };
    const fileContent = encryptBundle(bundle);

    // Build filename — support non-ASCII company names (Thai, CJK, etc.)
    let dateStr: string;
    try { dateStr = new Date(meta.issuedAt).toISOString().slice(0, 10); }
    catch { dateStr = new Date().toISOString().slice(0, 10); }

    // ASCII-safe fallback
    const asciiName = meta.company.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    const baseName = asciiName || 'bundle';
    const filename = `license-${baseName}-${dateStr}.aglic`;

    // RFC 5987: use filename* for UTF-8 names, filename for ASCII fallback
    const utf8Filename = `license-${meta.company}-${dateStr}.aglic`;
    const encodedFilename = encodeURIComponent(utf8Filename).replace(/'/g, '%27');

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition',
    `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`);
  res.send(fileContent);
});
