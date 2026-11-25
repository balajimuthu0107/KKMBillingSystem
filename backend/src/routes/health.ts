import { Router, Request, Response } from 'express';
import { isDbConnected, connectDB } from '../db.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  await connectDB();
  const connected = isDbConnected();

  res.json({
    status: 'ok',
    service: 'KKM Sea Foodz Billing Backend',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      provider: 'MongoDB Atlas',
      connected,
      message: connected
        ? 'MongoDB Atlas is active and handling requests.'
        : 'MongoDB Atlas is currently running in smart in-memory fallback mode. Configure MONGODB_URI in backend/.env to connect.'
    }
  });
});

export default router;
