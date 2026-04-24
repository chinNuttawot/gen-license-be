import { Router } from 'express';
import { generate } from '../controllers/licenseController';
import { exportBundle } from '../controllers/exportController';
import { validateGenerateLicense, validateExportBundle } from '../middlewares/validators';

const router = Router();

// POST /api/license/generate
router.post('/generate', validateGenerateLicense, generate);

// POST /api/license/export
router.post('/export', validateExportBundle, exportBundle);

export default router;
