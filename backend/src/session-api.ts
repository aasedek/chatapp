import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { SessionStore } from './session-store';

const DEFAULT_EXPIRY = 900; // 15 minutes
const MAX_EXPIRY = 3600; // 1 hour

export function createSessionRouter(store: SessionStore) {
  const router = express.Router();

  /**
   * POST /sessions
   * Create a new ephemeral session
   */
  router.post('/sessions', async (req: Request, res: Response) => {
    try {
      const expiresInSeconds = Math.min(
        req.body.expires_in_seconds || DEFAULT_EXPIRY,
        MAX_EXPIRY
      );

      const sessionId = uuidv4();
      const session = await store.createSession(sessionId, expiresInSeconds);

      res.status(201).json({
        session_id: session.session_id,
        expires_at: new Date(session.expires_at).toISOString(),
        expires_in_seconds: expiresInSeconds,
      });
    } catch (error) {
      console.error('Error creating session:', error);
      res.status(500).json({ error: 'Failed to create session' });
    }
  });

  /**
   * GET /sessions/:id
   * Get session metadata (for debugging/monitoring only)
   */
  router.get('/sessions/:id', async (req: Request, res: Response) => {
    try {
      const session = await store.getSession(req.params.id);

      if (!session) {
        return res.status(404).json({ error: 'Session not found or expired' });
      }

      res.json({
        session_id: session.session_id,
        status: session.status,
        participant_count: session.participant_count,
        expires_at: new Date(session.expires_at).toISOString(),
      });
    } catch (error) {
      console.error('Error fetching session:', error);
      res.status(500).json({ error: 'Failed to fetch session' });
    }
  });

  /**
   * DELETE /sessions/:id
   * Manually close a session
   */
  router.delete('/sessions/:id', async (req: Request, res: Response) => {
    try {
      await store.deleteSession(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting session:', error);
      res.status(500).json({ error: 'Failed to delete session' });
    }
  });

  return router;
}
