import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import routes from './routes';
import { notFoundHandler } from './middlewares/notFoundHandler';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

app.use(cors({ exposedHeaders: ['Content-Disposition'] }));
app.use(express.json({ limit: '10mb' }));

app.use(routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
