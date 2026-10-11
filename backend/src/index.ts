import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeFirebase } from './firebase.js';
import customerRoutes from './routes/customers.js';
import billRoutes from './routes/bills.js';
import healthRoutes from './routes/health.js';

dotenv.config();

// Initialize Firebase Admin
const firebaseStatus = initializeFirebase();

const app = express();
const PORT = process.env.PORT || 8080;

// Enable CORS for frontend Vite development & production
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, _res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// Root informational endpoint
app.get(['/', '/api'], (_req, res) => {
  res.json({
    name: 'KKM Sea Foodz Billing API',
    version: '1.0.0',
    firebaseConnected: firebaseStatus.isConnected,
    endpoints: {
      health: '/api/health',
      customers: '/api/customers',
      bills: '/api/bills',
      seed: '/api/customers/seed'
    }
  });
});

// Mount API routes (supports both /api/* and /* paths for Vercel rewrites)
app.use(['/api/health', '/health'], healthRoutes);
app.use(['/api/customers', '/customers'], customerRoutes);
app.use(['/api/bills', '/bills'], billRoutes);

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Backend Error]:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 KKM Sea Foodz Backend running on http://localhost:${PORT}`);
  console.log(`🔥 Firebase Status: ${firebaseStatus.isConnected ? 'CONNECTED (' + firebaseStatus.mode + ')' : 'FALLBACK MODE'}`);
  console.log(`📋 API Docs: http://localhost:${PORT}/`);
  console.log(`====================================================`);
});

export default app;
