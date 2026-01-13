/**
 * WebRTC Engine
 * 
 * Handles peer-to-peer connections for:
 * - Voice communication (audio streams)
 * - Text messaging (data channels)
 */

import { CryptoEngine } from './crypto';

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
}

export interface MessageHandler {
  onMessage: (message: string) => void;
  onEncryptedMessage?: (ciphertext: string) => void;
}

export class WebRTCEngine {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private localStream: MediaStream | null = null;
  private crypto: CryptoEngine;
  private messageHandler: MessageHandler | null = null;

  // Default STUN servers
  private static DEFAULT_ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  constructor(crypto: CryptoEngine, config?: WebRTCConfig) {
    this.crypto = crypto;
    this.initializePeerConnection(config);
  }

  private initializePeerConnection(config?: WebRTCConfig): void {
    const iceServers = config?.iceServers || WebRTCEngine.DEFAULT_ICE_SERVERS;

    this.peerConnection = new RTCPeerConnection({
      iceServers,
    });

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.onIceCandidate?.(event.candidate);
      }
    };

    // Handle incoming audio streams
    this.peerConnection.ontrack = (event) => {
      this.onRemoteStream?.(event.streams[0]);
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection?.connectionState);
      this.onConnectionStateChange?.(
        this.peerConnection?.connectionState || 'closed'
      );
    };
  }

  /**
   * Set up data channel for text messaging
   */
  setupDataChannel(isInitiator: boolean): void {
    if (isInitiator) {
      // Initiator creates the channel
      this.dataChannel = this.peerConnection!.createDataChannel('messages', {
        ordered: true,
      });
      this.setupDataChannelHandlers();
    } else {
      // Responder receives the channel
      this.peerConnection!.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.setupDataChannelHandlers();
      };
    }
  }

  private setupDataChannelHandlers(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log('Data channel opened');
      this.onDataChannelOpen?.();
    };

    this.dataChannel.onclose = () => {
      console.log('Data channel closed');
      this.onDataChannelClose?.();
    };

    this.dataChannel.onmessage = async (event) => {
      try {
        // Messages are encrypted
        const decrypted = await this.crypto.decrypt(event.data);
        this.messageHandler?.onMessage(decrypted);
      } catch (error) {
        console.error('Failed to decrypt message:', error);
      }
    };
  }

  /**
   * Start capturing local audio
   */
  async startAudio(): Promise<MediaStream> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      // Add audio tracks to peer connection
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });

      return this.localStream;
    } catch (error) {
      console.error('Failed to start audio:', error);
      throw error;
    }
  }

  /**
   * Stop local audio
   */
  stopAudio(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }

  /**
   * Create an offer (initiator)
   */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    const offer = await this.peerConnection!.createOffer();
    await this.peerConnection!.setLocalDescription(offer);
    return offer;
  }

  /**
   * Create an answer (responder)
   */
  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    const answer = await this.peerConnection!.createAnswer();
    await this.peerConnection!.setLocalDescription(answer);
    return answer;
  }

  /**
   * Set remote description
   */
  async setRemoteDescription(
    description: RTCSessionDescriptionInit
  ): Promise<void> {
    await this.peerConnection!.setRemoteDescription(description);
  }

  /**
   * Add ICE candidate
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    await this.peerConnection!.addIceCandidate(candidate);
  }

  /**
   * Send encrypted text message
   */
  async sendMessage(message: string): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

    const encrypted = await this.crypto.encrypt(message);
    this.dataChannel.send(encrypted);
  }

  /**
   * Set message handler
   */
  setMessageHandler(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  /**
   * Close connection
   */
  close(): void {
    this.stopAudio();

    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }

  // Event handlers (to be set by users of this class)
  onIceCandidate?: (candidate: RTCIceCandidate) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onDataChannelOpen?: () => void;
  onDataChannelClose?: () => void;
}
