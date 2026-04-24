import { Router } from 'express';
import licenseRoutes from './licenseRoutes';

const router = Router();

// Health Check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'antigravity-license-api', timestamp: new Date().toISOString() });
});

// API Routes
router.use('/api/license', licenseRoutes);

export default router;
