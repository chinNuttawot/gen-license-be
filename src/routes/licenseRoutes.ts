import { Router } from 'express';
import { generate } from '../controllers/licenseController';
import { exportBundle } from '../controllers/exportController';

const router = Router();

// POST /api/license/generate
router.post('/generate', generate);

// POST /api/license/export
router.post('/export', exportBundle);

export default router;
