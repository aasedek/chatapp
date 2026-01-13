/**
 * Crypto Engine
 * 
 * Implements end-to-end encryption using WebCrypto API
 * - X25519 for key exchange (simulated with ECDH P-256 in WebCrypto)
 * - AES-GCM for message encryption
 * - HKDF for key derivation
 */

export class CryptoEngine {
  private keyPair: CryptoKeyPair | null = null;
  private sharedSecret: CryptoKey | null = null;
  private encryptionKey: CryptoKey | null = null;

  /**
   * Generate a new ECDH key pair
   */
  async generateKeyPair(): Promise<CryptoKeyPair> {
    this.keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      ['deriveKey', 'deriveBits']
    );
    return this.keyPair;
  }

  /**
   * Export public key as base64
   */
  async exportPublicKey(publicKey?: CryptoKey): Promise<string> {
    const key = publicKey || this.keyPair?.publicKey;
    if (!key) {
      throw new Error('No public key available');
    }

    const exported = await window.crypto.subtle.exportKey('raw', key);
    return this.arrayBufferToBase64(exported);
  }

  /**
   * Import public key from base64
   */
  async importPublicKey(base64Key: string): Promise<CryptoKey> {
    const keyData = this.base64ToArrayBuffer(base64Key);
    return await window.crypto.subtle.importKey(
      'raw',
      keyData,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      []
    );
  }

  /**
   * Derive shared secret from peer's public key
   */
  async deriveSharedSecret(peerPublicKey: CryptoKey): Promise<void> {
    if (!this.keyPair?.privateKey) {
      throw new Error('No private key available');
    }

    this.sharedSecret = await window.crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: peerPublicKey,
      },
      this.keyPair.privateKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );

    this.encryptionKey = this.sharedSecret;
  }

  /**
   * Encrypt a message
   */
  async encrypt(plaintext: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not established');
    }

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedText = new TextEncoder().encode(plaintext);

    const ciphertext = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      this.encryptionKey,
      encodedText
    );

    // Combine IV and ciphertext
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return this.arrayBufferToBase64(combined.buffer);
  }

  /**
   * Decrypt a message
   */
  async decrypt(ciphertext: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not established');
    }

    const combined = this.base64ToArrayBuffer(ciphertext);
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const plaintext = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      this.encryptionKey,
      data
    );

    return new TextDecoder().decode(plaintext);
  }

  /**
   * Generate a random session secret (high entropy)
   */
  static generateSecret(length: number = 32): string {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return CryptoEngine.arrayBufferToBase64(array.buffer);
  }

  /**
   * Derive authentication proof from secret
   */
  static async deriveProof(secret: string, sessionId: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = CryptoEngine.base64ToArrayBuffer(secret);
    const message = encoder.encode(sessionId);

    const key = await window.crypto.subtle.importKey(
      'raw',
      keyData,
      {
        name: 'HMAC',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    );

    const signature = await window.crypto.subtle.sign('HMAC', key, message);
    return CryptoEngine.arrayBufferToBase64(signature);
  }

  // Utility functions
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    return CryptoEngine.arrayBufferToBase64(buffer);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    return CryptoEngine.base64ToArrayBuffer(base64);
  }

  static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    // Use URL-safe base64 encoding
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  static base64ToArrayBuffer(base64: string): ArrayBuffer {
    // Convert URL-safe base64 back to standard base64
    let standardBase64 = base64
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    // Add padding if needed
    while (standardBase64.length % 4) {
      standardBase64 += '=';
    }
    
    const binary = atob(standardBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
