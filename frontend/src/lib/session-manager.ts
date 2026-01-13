/**
 * Session Manager
 * 
 * Handles session lifecycle:
 * - Creating new sessions
 * - Joining existing sessions
 * - Parsing session URLs
 * - WebSocket signaling coordination
 */

import { CryptoEngine } from './crypto';
import { WebRTCEngine } from './webrtc';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

export interface SessionInfo {
  sessionId: string;
  secret: string;
  expiresAt: string;
}

export interface SessionCallbacks {
  onReady?: () => void;
  onMessage?: (message: string) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onPeerLeft?: () => void;
  onError?: (error: string) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
}

export class SessionManager {
  private ws: WebSocket | null = null;
  private crypto: CryptoEngine;
  private webrtc: WebRTCEngine | null = null;
  private sessionInfo: SessionInfo | null = null;
  private role: 'initiator' | 'responder' | null = null;
  private callbacks: SessionCallbacks = {};

  constructor() {
    this.crypto = new CryptoEngine();
  }

  /**
   * Create a new session
   */
  async createSession(expiresInSeconds: number = 900): Promise<string> {
    try {
      const response = await fetch(`${API_URL}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expires_in_seconds: expiresInSeconds }),
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const data = await response.json();
      const secret = CryptoEngine.generateSecret();

      this.sessionInfo = {
        sessionId: data.session_id,
        secret,
        expiresAt: data.expires_at,
      };

      // Generate session URL
      const url = `${window.location.origin}/#/s/${data.session_id}:${secret}`;
      return url;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  }

  /**
   * Parse session URL or session data string
   */
  static parseSessionUrl(urlOrData: string): SessionInfo | null {
    try {
      let sessionData = urlOrData;
      
      // If it's a full URL, extract the hash fragment
      if (urlOrData.includes('#')) {
        const hash = urlOrData.split('#')[1];
        sessionData = hash;
      }
      
      // Remove leading slash if present
      sessionData = sessionData.replace(/^\/s\//, '');
      
      // Parse format: sessionId:secret
      const colonIndex = sessionData.indexOf(':');
      if (colonIndex === -1) {
        return null;
      }

      const sessionId = sessionData.substring(0, colonIndex);
      const secret = sessionData.substring(colonIndex + 1);
      
      if (!sessionId || !secret) {
        return null;
      }

      return {
        sessionId,
        secret,
        expiresAt: '', // Will be fetched from server
      };
    } catch (error) {
      console.error('Failed to parse session URL:', error);
      return null;
    }
  }

  /**
   * Join a session
   */
  async joinSession(sessionInfo: SessionInfo, callbacks: SessionCallbacks): Promise<void> {
    this.sessionInfo = sessionInfo;
    this.callbacks = callbacks;

    // Initialize WebRTC
    this.webrtc = new WebRTCEngine(this.crypto);
    this.webrtc.onIceCandidate = this.handleIceCandidate.bind(this);
    this.webrtc.onRemoteStream = (stream) => this.callbacks.onRemoteStream?.(stream);
    this.webrtc.onConnectionStateChange = (state) => this.callbacks.onConnectionStateChange?.(state);
    this.webrtc.setMessageHandler({
      onMessage: (message) => this.callbacks.onMessage?.(message),
    });

    // Connect to signaling server
    await this.connectSignaling();
  }

  /**
   * Connect to signaling server
   */
  private async connectSignaling(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${WS_URL}/signaling`);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.authenticate();
        resolve();
      };

      this.ws.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        await this.handleSignalingMessage(message);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.callbacks.onError?.('Connection failed');
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
        // Don't call cleanup here - let the component handle it
      };
    });
  }

  /**
   * Authenticate with signaling server
   */
  private authenticate(): void {
    if (!this.ws || !this.sessionInfo) return;

    this.ws.send(
      JSON.stringify({
        type: 'auth',
        sessionId: this.sessionInfo.sessionId,
      })
    );
  }

  /**
   * Handle signaling messages
   */
  private async handleSignalingMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'auth':
        if (message.payload.success) {
          this.role = message.payload.role;
          console.log('Authenticated as', this.role);
          await this.crypto.generateKeyPair();
          this.webrtc!.setupDataChannel(this.role === 'initiator');
        }
        break;

      case 'ready':
        console.log('Both participants ready');
        if (this.role === 'initiator') {
          await this.initiateConnection();
        }
        this.callbacks.onReady?.();
        break;

      case 'offer':
        await this.handleOffer(message.payload);
        break;

      case 'answer':
        await this.handleAnswer(message.payload);
        break;

      case 'ice-candidate':
        await this.handleRemoteIceCandidate(message.payload);
        break;

      case 'peer-left':
        this.callbacks.onPeerLeft?.();
        break;

      case 'error':
        this.callbacks.onError?.(message.payload.error);
        break;
    }
  }

  /**
   * Initiate WebRTC connection (initiator only)
   */
  private async initiateConnection(): Promise<void> {
    try {
      const publicKey = await this.crypto.exportPublicKey();
      const offer = await this.webrtc!.createOffer();

      this.sendSignaling({
        type: 'offer',
        payload: {
          sdp: offer,
          publicKey,
        },
      });
    } catch (error) {
      console.error('Failed to create offer:', error);
      this.callbacks.onError?.('Failed to initiate connection');
    }
  }

  /**
   * Handle incoming offer (responder only)
   */
  private async handleOffer(payload: any): Promise<void> {
    try {
      await this.webrtc!.setRemoteDescription(payload.sdp);

      // Import peer's public key and derive shared secret
      const peerPublicKey = await this.crypto.importPublicKey(payload.publicKey);
      await this.crypto.deriveSharedSecret(peerPublicKey);

      const publicKey = await this.crypto.exportPublicKey();
      const answer = await this.webrtc!.createAnswer();

      this.sendSignaling({
        type: 'answer',
        payload: {
          sdp: answer,
          publicKey,
        },
      });
    } catch (error) {
      console.error('Failed to handle offer:', error);
      this.callbacks.onError?.('Failed to establish connection');
    }
  }

  /**
   * Handle incoming answer (initiator only)
   */
  private async handleAnswer(payload: any): Promise<void> {
    try {
      await this.webrtc!.setRemoteDescription(payload.sdp);

      // Import peer's public key and derive shared secret
      const peerPublicKey = await this.crypto.importPublicKey(payload.publicKey);
      await this.crypto.deriveSharedSecret(peerPublicKey);
    } catch (error) {
      console.error('Failed to handle answer:', error);
      this.callbacks.onError?.('Failed to establish connection');
    }
  }

  /**
   * Handle ICE candidate from local peer
   */
  private handleIceCandidate(candidate: RTCIceCandidate): void {
    this.sendSignaling({
      type: 'ice-candidate',
      payload: candidate.toJSON(),
    });
  }

  /**
   * Handle ICE candidate from remote peer
   */
  private async handleRemoteIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      await this.webrtc!.addIceCandidate(candidate);
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
    }
  }

  /**
   * Send signaling message
   */
  private sendSignaling(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Start voice communication
   */
  async startVoice(): Promise<MediaStream> {
    if (!this.webrtc) {
      throw new Error('Not connected to session');
    }
    return await this.webrtc.startAudio();
  }

  /**
   * Stop voice communication
   */
  stopVoice(): void {
    this.webrtc?.stopAudio();
  }

  /**
   * Send text message
   */
  async sendMessage(message: string): Promise<void> {
    if (!this.webrtc) {
      throw new Error('Not connected to session');
    }
    await this.webrtc.sendMessage(message);
  }

  /**
   * Leave session and cleanup
   */
  cleanup(): void {
    this.webrtc?.close();
    this.webrtc = null;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.sessionInfo = null;
    this.role = null;
  }

  /**
   * Get session info
   */
  getSessionInfo(): SessionInfo | null {
    return this.sessionInfo;
  }

  /**
   * Get connection role
   */
  getRole(): 'initiator' | 'responder' | null {
    return this.role;
  }
}
