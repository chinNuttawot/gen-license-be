import app from './app';
import { connectDB } from './config/database.config';

const PORT = process.env.PORT ?? 4000;

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`\n🛡️  Generate License License API (TypeScript) running on http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health\n`);
  });
};

startServer();
