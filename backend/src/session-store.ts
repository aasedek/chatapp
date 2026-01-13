import { createClient } from 'redis';

export interface Session {
  session_id: string;
  expires_at: number;
  status: 'OPEN' | 'JOINED' | 'CLOSED';
  participant_count: number;
  created_at: number;
}

export class SessionStore {
  private client: ReturnType<typeof createClient>;
  private connected: boolean = false;

  constructor(host: string = 'localhost', port: number = 6379) {
    this.client = createClient({
      socket: {
        host,
        port,
      },
    });

    this.client.on('error', (err) => console.error('Redis Client Error:', err));
    this.client.on('connect', () => console.log('Redis Client Connected'));
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      await this.client.connect();
      this.connected = true;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.disconnect();
      this.connected = false;
    }
  }

  private getKey(sessionId: string): string {
    return `session:${sessionId}`;
  }

  async createSession(
    sessionId: string,
    expiresInSeconds: number
  ): Promise<Session> {
    const now = Date.now();
    const session: Session = {
      session_id: sessionId,
      expires_at: now + expiresInSeconds * 1000,
      status: 'OPEN',
      participant_count: 0,
      created_at: now,
    };

    const key = this.getKey(sessionId);
    await this.client.setEx(key, expiresInSeconds, JSON.stringify(session));

    return session;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const key = this.getKey(sessionId);
    const data = await this.client.get(key);

    if (!data) {
      return null;
    }

    const session = JSON.parse(data) as Session;

    // Check if expired
    if (Date.now() > session.expires_at) {
      await this.deleteSession(sessionId);
      return null;
    }

    return session;
  }

  async updateSession(session: Session): Promise<void> {
    const key = this.getKey(session.session_id);
    const ttl = Math.max(
      1,
      Math.floor((session.expires_at - Date.now()) / 1000)
    );

    if (ttl > 0) {
      await this.client.setEx(key, ttl, JSON.stringify(session));
    } else {
      await this.deleteSession(session.session_id);
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const key = this.getKey(sessionId);
    await this.client.del(key);
  }

  async joinSession(sessionId: string): Promise<Session | null> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return null;
    }

    // Check actual participant count, not just status
    if (session.participant_count >= 2) {
      return null; // Already full
    }

    session.participant_count += 1;

    if (session.participant_count === 1) {
      session.status = 'JOINED';
    } else if (session.participant_count === 2) {
      session.status = 'CLOSED'; // Lock session
    }

    await this.updateSession(session);
    return session;
  }

  async leaveSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return;
    }

    session.participant_count = Math.max(0, session.participant_count - 1);

    // Always update status, never delete the session
    // Let it expire naturally via TTL
    if (session.participant_count === 0) {
      session.status = 'OPEN';
    } else if (session.participant_count === 1) {
      session.status = 'JOINED';
    } else {
      session.status = 'CLOSED';
    }
    
    await this.updateSession(session);
  }
}
