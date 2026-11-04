import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import express, { Request, Response } from 'express';

// Load .env and .env.local from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { apiApp } from './apiRouter.ts';
import { connectMySql, isMySqlConnected, getProductsCountFromDb } from './db.ts';

const app = express();

// Disable x-powered-by header
app.disable('x-powered-by');

// Global CORS & Preflight handling for Android, iOS, Expo Go, Web & curl
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Accept, x-customer-id, x-admin-role, x-admin-token, x-staff-token, x-auth-token, x-vercel-matched-path'
  );
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  next();
});

// Request Logging for diagnostic debugging
app.use((req, res, next) => {
  const start = Date.now();
  const remoteIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  res.on('finish', () => {
    if (req.method !== 'OPTIONS') {
      console.log(`[API ${req.method}] ${req.originalUrl || req.url} -> ${res.statusCode} (${Date.now() - start}ms) [${remoteIp}]`);
    }
  });
  next();
});

// Root & Health Check Endpoints
app.get(['/', '/health', '/api/health'], async (_req: Request, res: Response) => {
  let productCount = 0;
  try {
    productCount = await getProductsCountFromDb();
  } catch {
    // ignore
  }

  res.json({
    status: 'ok',
    service: 'FreshCart Backend API',
    version: '1.0.0',
    time: new Date().toISOString(),
    database: isMySqlConnected() ? 'connected' : 'disconnected',
    productCount,
    lanIp: '10.211.209.237',
    port: PORT,
  });
});

// Mount the comprehensive FreshCart API Router
app.use(apiApp);

// 404 handler for undefined API routes
app.use('/api', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.originalUrl || req.url}`,
  });
});

const PORT = Number(process.env.PORT) || 3000;
const HOST = '::';

async function startServer() {
  console.log('🔄 Initializing TiDB Cloud MySQL connection pool...');
  try {
    await connectMySql();
    console.log('✓ MySQL Database pool connected successfully.');
  } catch (err: any) {
    console.warn('⚠️ Initial MySQL connection warning (will retry on incoming requests):', err?.message || err);
  }

  const server = http.createServer(app);

  server.listen(PORT, HOST, () => {
    console.log('====================================================================');
    console.log('🚀 FreshCart Backend API Server running successfully');
    console.log(`📍 Listening on: [::]:${PORT} (Dual-Stack IPv4 & IPv6 enabled)`);
    console.log(`🌐 Local LAN Access: http://10.211.209.237:${PORT}`);
    console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
    console.log('====================================================================');
  });

  server.on('error', (err: any) => {
    console.error('❌ Server startup error:', err);
    process.exit(1);
  });
}

// Start if executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('server.ts')) {
  startServer();
}

export default app;
export { startServer };

