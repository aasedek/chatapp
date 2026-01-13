# Security Policy

## Security Principles

This application is designed with security and privacy as first-class concerns:

1. **Zero Knowledge**: The server never has access to encryption keys or plaintext content
2. **End-to-End Encryption**: All messages are encrypted on the client side before transmission
3. **Ephemeral by Design**: Sessions auto-destruct and leave no traces
4. **No Identity**: No user accounts, tracking, or persistent identifiers

## Reporting Security Vulnerabilities

If you discover a security vulnerability, please follow responsible disclosure:

1. **DO NOT** open a public GitHub issue
2. Email security concerns to: [your-security-email@example.com]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will acknowledge receipt within 48 hours and work with you to address the issue.

## Security Features

### Implemented

- ✅ End-to-end encryption (AES-GCM)
- ✅ ECDH key exchange (P-256)
- ✅ WebRTC DTLS-SRTP for voice
- ✅ Session expiry and auto-cleanup
- ✅ One-to-one enforcement
- ✅ No server-side content storage
- ✅ CORS protection
- ✅ Helmet.js security headers

### Production Requirements

For production deployment, ensure:

- [ ] HTTPS/TLS enabled (required for WebCrypto and getUserMedia)
- [ ] Secure WebSocket (wss://)
- [ ] Rate limiting on session creation
- [ ] TURN server with authentication
- [ ] Regular security updates
- [ ] Monitoring without content logging

## Known Limitations

1. **URL Security**: The session URL contains the encryption key. Share securely (e.g., Signal, in person)
2. **Browser Security**: Relies on browser's implementation of WebCrypto
3. **Endpoint Security**: If either client is compromised, E2EE is ineffective
4. **Metadata**: Server can see IP addresses and connection timing (but not content)

## Best Practices for Users

1. Only share session URLs through secure channels
2. Verify you're connected to the correct peer (out-of-band verification)
3. Use HTTPS version in production
4. Don't share session URLs publicly
5. Close sessions immediately after use

## Cryptographic Specifications

- **Key Exchange**: ECDH with P-256 curve
- **Symmetric Encryption**: AES-GCM with 256-bit keys
- **Voice Encryption**: DTLS-SRTP (WebRTC standard)
- **Random Generation**: window.crypto.getRandomValues
- **Key Derivation**: Built-in ECDH derivation to AES-GCM key

## Updates and Patches

Security updates will be released as soon as possible. Monitor:

- GitHub releases
- Security advisories
- Dependency updates (Dependabot enabled)

---

Last updated: January 13, 2026
