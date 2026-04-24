import { Request, Response } from 'express';
import { encryptBundle, encryptToken } from '../utils/bundleCrypto';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { AppDataSource } from '../config/database.config';
import { Company } from '../entities/Company.entity';
import { LicenseRecord } from '../entities/LicenseRecord.entity';

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

  // -------------------------------------------------------------------------
  // Save to Database (Moved from Generate Phase)
  // -------------------------------------------------------------------------
  try {
    const companyRepo = AppDataSource.getRepository(Company);
    const recordRepo = AppDataSource.getRepository(LicenseRecord);

    const generatedAtDate = new Date(meta.issuedAt);

    // Check for duplicate export (to prevent double DB saving)
    const existingCompany = await companyRepo.findOne({ where: { name: meta.company } });
    let isDuplicate = false;
    
    if (existingCompany) {
      const existingRecord = await recordRepo.findOne({
        where: {
          companyId: existingCompany.id,
          generatedAt: generatedAtDate,
        }
      });
      if (existingRecord) {
        isDuplicate = true;
      }
    }

    if (!isDuplicate) {
      let companyEntity = existingCompany;
      if (!companyEntity) {
        companyEntity = companyRepo.create({ name: meta.company });
        await companyRepo.save(companyEntity);
      }

      const expiryDate = new Date(meta.expiry);
      const recordsToSave = [];

      if (meta.licenseType === 'station-based' && meta.hwids && meta.hwids.length > 0) {
        // One record per HWID
        for (let i = 0; i < tokens.length; i++) {
          recordsToSave.push(recordRepo.create({
            companyId: companyEntity.id,
            licenseType: meta.licenseType,
            quantity: 1,
            hwid: meta.hwids[i] || null,
            validUntil: expiryDate,
            generatedAt: generatedAtDate,
            encryptedToken: encryptToken(tokens[i]),
          }));
        }
      } else {
        // Account-based: Save each token
        for (let i = 0; i < tokens.length; i++) {
          recordsToSave.push(recordRepo.create({
            companyId: companyEntity.id,
            licenseType: meta.licenseType,
            quantity: 1,
            hwid: null,
            validUntil: expiryDate,
            generatedAt: generatedAtDate,
            encryptedToken: encryptToken(tokens[i]),
          }));
        }
      }
      await recordRepo.save(recordsToSave);
      console.log(`[Export] Saved ${recordsToSave.length} records to DB.`);
    } else {
      console.log(`[Export] Duplicate export detected for issuedAt=${meta.issuedAt}. Skipping DB save.`);
    }
  } catch (dbErr) {
    console.error('[exportController.exportBundle] DB Save Error:', dbErr);
    // Ignore error, allow export to proceed and return file
  }

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
