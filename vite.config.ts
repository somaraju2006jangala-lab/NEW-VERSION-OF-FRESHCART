import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv, Plugin } from 'vite';

const projectRootDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)));

// Ensure project root .env is loaded into process.env before server middleware is attached
try {
  const envFiles = [
    path.join(projectRootDir, '.env'),
    path.join(projectRootDir, '.env.local'),
  ];
  for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
      const parsed = dotenv.parse(fs.readFileSync(envFile, 'utf-8'));
      for (const [k, v] of Object.entries(parsed)) {
        if (v && typeof v === 'string' && v.trim().length > 0) {
          if (!process.env[k] || process.env[k]!.trim().length === 0) {
            process.env[k] = v.trim();
          }
        }
      }
    }
  }
} catch {
  // ignore
}

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { apiApp } from './server/apiRouter.ts';
import { connectMySql } from './server/db.ts';

function isApiPath(url?: string): boolean {
  if (!url) return false;
  const pathname = url.split('?')[0];
  return pathname === '/api' || pathname.startsWith('/api/');
}

function backendApiPlugin(): Plugin {
  const attachMiddleware = (middlewares: any) => {
    // Eagerly warm MySQL pool & schema when Vite dev/preview server starts
    void connectMySql().catch(() => {});

    middlewares.use((req: any, res: any, next: any) => {
      // Universal CORS headers for Android Expo Go, iOS, Web & curl
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, Accept, x-customer-id, x-admin-role, x-admin-token, x-staff-token, x-auth-token, x-client-platform, x-client, x-vercel-matched-path'
      );
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      const apiRequest = isApiPath(req.url);
      (apiApp as any)(req, res, (err?: any) => {
        if (err) {
          if (apiRequest && !res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err?.message || 'Internal API error' }));
            return;
          }
          next(err);
          return;
        }
        // Prevent unmatched /api/* routes from falling through to Vite's index.html SPA fallback
        if (apiRequest && !res.headersSent) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              success: false,
              error: `API route not found: ${req.method} ${req.url}`,
            })
          );
          return;
        }
        next();
      });
    });
  };

  return {
    name: 'backend-otp-api-plugin',
    configureServer(server) {
      attachMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachMiddleware(server.middlewares);
    },
  };
}

export default defineConfig(({ mode }) => {
  // Synchronize all environment variables (including server secrets) into process.env
  const env = loadEnv(mode, process.cwd(), '');
  for (const [key, val] of Object.entries(env)) {
    if (val && typeof val === 'string' && val.trim().length > 0) {
      if (!process.env[key] || process.env[key]!.trim().length === 0) {
        process.env[key] = val.trim();
      }
    }
  }

  return {
    plugins: [react(), tailwindcss(), backendApiPlugin()],
    resolve: {
      alias: {
        '@': projectRootDir,
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
      cors: true,
      allowedHosts: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              if (id.includes('react/') || id.includes('react-dom/')) {
                return 'vendor-react';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('motion')) {
                return 'vendor-motion';
              }
              if (id.includes('qrcode') || id.includes('jsqr')) {
                return 'vendor-qr';
              }
              return 'vendor-libs';
            }
          },
        },
      },
    },
  };
});
