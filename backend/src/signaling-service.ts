import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { SessionStore } from './session-store';
import crypto from 'crypto';

interface ClientInfo {
  sessionId: string;
  role: 'initiator' | 'responder';
  ws: WebSocket;
  authenticated: boolean;
}

interface SignalingMessage {
  type: 'auth' | 'offer' | 'answer' | 'ice-candidate' | 'ready' | 'peer-left';
  sessionId?: string;
  proof?: string;
  payload?: any;
}

export class SignalingService {
  private wss: WebSocketServer;
  private store: SessionStore;
  private clients: Map<WebSocket, ClientInfo> = new Map();
  private sessions: Map<string, Set<WebSocket>> = new Map();

  constructor(wss: WebSocketServer, store: SessionStore) {
    this.wss = wss;
    this.store = store;
    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      console.log('New WebSocket connection');

      ws.on('message', async (data: string) => {
        try {
          const message: SignalingMessage = JSON.parse(data.toString());
          await this.handleMessage(ws, message);
        } catch (error) {
          console.error('Error handling message:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  private async handleMessage(
    ws: WebSocket,
    message: SignalingMessage
  ): Promise<void> {
    switch (message.type) {
      case 'auth':
        await this.handleAuth(ws, message);
        break;

      case 'offer':
      case 'answer':
      case 'ice-candidate':
        await this.relayMessage(ws, message);
        break;

      default:
        this.sendError(ws, 'Unknown message type');
    }
  }

  private async handleAuth(
    ws: WebSocket,
    message: SignalingMessage
  ): Promise<void> {
    if (!message.sessionId) {
      return this.sendError(ws, 'Missing session ID');
    }

    // Check if session exists first
    const existingSession = await this.store.getSession(message.sessionId);
    
    if (!existingSession) {
      return this.sendError(ws, 'Session expired or not found');
    }

    // Clean up any stale/closed connections in this session first
    const sessionClients = this.sessions.get(message.sessionId) || new Set();
    let cleanedCount = 0;
    
    sessionClients.forEach((client) => {
      if (client.readyState === WebSocket.CLOSED || client.readyState === WebSocket.CLOSING) {
        sessionClients.delete(client);
        this.clients.delete(client);
        cleanedCount++;
      }
    });

    // Sync Redis count with actual WebSocket connections
    if (cleanedCount > 0) {
      for (let i = 0; i < cleanedCount; i++) {
        await this.store.leaveSession(message.sessionId);
      }
      console.log(`Cleaned up ${cleanedCount} stale connections for session ${message.sessionId}`);
    }

    // Enforce maximum 2 active WebSocket participants
    if (sessionClients.size >= 2) {
      return this.sendError(ws, 'Session is full');
    }

    // Verify session exists and join it in Redis
    const session = await this.store.joinSession(message.sessionId);

    if (!session) {
      return this.sendError(ws, 'Session is full');
    }

    // Determine role based on participant count
    const role: 'initiator' | 'responder' =
      sessionClients.size === 0 ? 'initiator' : 'responder';

    // Register client
    const clientInfo: ClientInfo = {
      sessionId: message.sessionId,
      role,
      ws,
      authenticated: true,
    };

    this.clients.set(ws, clientInfo);
    sessionClients.add(ws);
    this.sessions.set(message.sessionId, sessionClients);

    // Send auth success
    this.send(ws, {
      type: 'auth',
      payload: {
        success: true,
        role,
        participant_count: sessionClients.size,
      },
    });

    // Notify peer if they exist
    if (sessionClients.size === 2) {
      sessionClients.forEach((client) => {
        this.send(client, {
          type: 'ready',
          payload: { participants: 2 },
        });
      });
    }

    console.log(
      `Client authenticated: session=${message.sessionId}, role=${role}, total=${sessionClients.size}`
    );
  }

  private async relayMessage(
    ws: WebSocket,
    message: SignalingMessage
  ): Promise<void> {
    const clientInfo = this.clients.get(ws);

    if (!clientInfo || !clientInfo.authenticated) {
      return this.sendError(ws, 'Not authenticated');
    }

    const sessionClients = this.sessions.get(clientInfo.sessionId);

    if (!sessionClients) {
      return this.sendError(ws, 'Session not found');
    }

    // Relay message to the other peer
    sessionClients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        this.send(client, message);
      }
    });
  }

  private handleDisconnect(ws: WebSocket): void {
    const clientInfo = this.clients.get(ws);

    if (clientInfo) {
      const sessionClients = this.sessions.get(clientInfo.sessionId);

      if (sessionClients) {
        sessionClients.delete(ws);

        // Notify peer that other participant left
        sessionClients.forEach((client) => {
          this.send(client, {
            type: 'peer-left',
            payload: {},
          });
        });

        // Clean up session if empty
        if (sessionClients.size === 0) {
          this.sessions.delete(clientInfo.sessionId);
          this.store.leaveSession(clientInfo.sessionId).catch(console.error);
        } else {
          this.store.leaveSession(clientInfo.sessionId).catch(console.error);
        }
      }

      this.clients.delete(ws);
      console.log(`Client disconnected from session ${clientInfo.sessionId}`);
    }
  }

  private send(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, error: string): void {
    this.send(ws, {
      type: 'error',
      payload: { error },
    });
  }
}
