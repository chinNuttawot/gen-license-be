import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import licenseRoutes from './routes/licenseRoutes';

const app = express();
const PORT = process.env.PORT ?? 4000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
// Allow all origins — any frontend, agent, or tool can call this API
app.use(cors({ exposedHeaders: ['Content-Disposition'] }));
app.use(express.json({ limit: '10mb' }));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api/license', licenseRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'antigravity-license-api', timestamp: new Date().toISOString() });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`\n🛡️  Generate License License API (TypeScript) running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
});
