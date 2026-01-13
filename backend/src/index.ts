import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { SessionStore } from './session-store';
import { createSessionRouter } from './session-api';
import { SignalingService } from './signaling-service';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '3001', 10);
const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

async function startServer() {
  // Initialize session store
  const sessionStore = new SessionStore(REDIS_URL, REDIS_PORT);
  await sessionStore.connect();

  // Create Express app
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Disable for WebSocket
  }));

  app.use(cors({
    origin: CORS_ORIGIN,
    credentials: true,
  }));

  app.use(express.json());

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Session API routes
  app.use('/api', createSessionRouter(sessionStore));

  // Create HTTP server
  const server = createServer(app);

  // Create WebSocket server for signaling
  const wss = new WebSocketServer({
    server,
    path: '/signaling',
  });

  // Initialize signaling service
  new SignalingService(wss, sessionStore);

  // Start server
  server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║  Ephemeral Secure Chat Server          ║
╠════════════════════════════════════════╣
║  HTTP API:    http://localhost:${PORT}  ║
║  WebSocket:   ws://localhost:${PORT}/signaling
║  Redis:       ${REDIS_URL}
╚════════════════════════════════════════╝
    `);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(async () => {
      await sessionStore.disconnect();
      process.exit(0);
    });
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
