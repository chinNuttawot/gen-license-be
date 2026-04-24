import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

export const validateGenerateLicense = (req: Request, _res: Response, next: NextFunction) => {
  const { company, licenseType, quantity, hwids, expiry } = req.body;

  if (!company || typeof company !== 'string' || !company.trim()) {
    throw new AppError(400, 'company is required.');
  }

  if (!(['account-based', 'station-based'] as const).includes(licenseType)) {
    throw new AppError(400, 'licenseType must be "account-based" or "station-based".');
  }

  if (!expiry || isNaN(Date.parse(expiry))) {
    throw new AppError(400, 'expiry must be a valid ISO date string (yyyy-mm-dd).');
  }
  if (new Date(expiry).getTime() <= Date.now()) {
    throw new AppError(400, 'expiry must be a future date.');
  }

  if (licenseType === 'station-based') {
    if (!Array.isArray(hwids) || hwids.length === 0) {
      throw new AppError(400, 'hwids[] is required for station-based licenses.');
    }
    const cleanedHwids = hwids.map((h: string) => h.trim());
    if (cleanedHwids.some((h: string) => !h)) {
      throw new AppError(400, 'All hardware IDs must be non-empty strings.');
    }
    const uniqueHwids = new Set(cleanedHwids);
    if (uniqueHwids.size !== cleanedHwids.length) {
      throw new AppError(400, 'Duplicate hardware IDs are not allowed.');
    }
    req.body.hwids = cleanedHwids; // Pass cleaned back to req
  } else {
    const total = Number(quantity);
    if (!Number.isInteger(total) || total < 1) {
      throw new AppError(400, 'quantity must be a positive integer (minimum 1).');
    }
    req.body.quantity = total; // Pass cleaned back to req
  }

  next();
};

export const validateExportBundle = (req: Request, _res: Response, next: NextFunction) => {
  const { tokens, meta } = req.body;

  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw new AppError(400, 'tokens array is required and must not be empty.');
  }
  if (!meta?.company || !meta?.expiry) {
    throw new AppError(400, 'meta.company and meta.expiry are required.');
  }

  next();
};
