import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { checkDb } from './db.js';
import authRouter from './auth/routes.js';
import jobCoachRouter from './job-coach/routes.js';
import subscriptionRouter from './subscription/routes.js';
import paymentRouter from './payment/routes.js';

const app = express();
const port = Number(process.env.PORT || 8790);

app.use(cors());
app.use('/api/payment/notify', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '1mb' }));
app.use((_req, res, next) => { res.setTimeout(30000, () => res.status(503).json({ error: 'timeout' })); next(); });

app.get('/api/health', async (_req, res) => {
  const db = await checkDb();
  res.json({ ok: db.ok, ai: !!process.env.OPENAI_API_KEY, mode: process.env.OPENAI_API_KEY ? 'ai' : 'demo' });
});

app.use('/api/auth', authRouter);
app.use('/api', jobCoachRouter);
app.use('/api/subscription', subscriptionRouter);
app.use('/api/payment', paymentRouter);

export { app, port };
