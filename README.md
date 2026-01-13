# Ephemeral Secure Chat

A privacy-focused, ephemeral one-to-one chat application with end-to-end encryption for text and voice communication.

## 🔐 Core Features

- **Zero Identity**: No signup, no accounts, no usernames
- **End-to-End Encryption**: Messages encrypted using WebCrypto API (AES-GCM)
- **One-to-One Only**: Hard limit of 2 participants per session (technically enforced)
- **Ephemeral by Design**: Sessions auto-expire and self-destruct
- **Link-Based Capability**: The URL itself is the authorization token
- **Voice + Text**: Real-time voice communication via WebRTC with encrypted text messaging
- **No Server Access**: Server cannot decrypt messages or access content

## 🏗️ Architecture

```
┌────────────┐        ┌─────────────┐
│  Client A  │◀──────▶│  Client B   │
└─────▲──────┘  WebRTC └─────▲───────┘
      │      (E2EE)          │
      │                     │
      │   Signaling         │
      ▼                     ▼
┌─────────────────────────────────┐
│    Signaling Service (WS)        │
└─────────────────────────────────┘
              ▲
┌─────────────────────────────────┐
│   Session Control API (REST)     │
└─────────────────────────────────┘
              ▲
┌─────────────────────────────────┐
│   Redis (Ephemeral Sessions)     │
└─────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- Redis (for session storage)
- Modern browser with WebRTC support

### Development Setup

1. **Clone and install dependencies**

```bash
cd COMAPP
npm install
```

2. **Set up environment variables**

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your configuration
```

3. **Start Redis**

```bash
# Using Docker
docker run -d -p 6379:6379 redis:7-alpine

# Or install Redis locally
# macOS: brew install redis && redis-server
# Ubuntu: sudo apt install redis && redis-server
# Windows: Use WSL or Redis for Windows
```

4. **Start development servers**

```bash
# Start both frontend and backend
npm run dev

# Or start individually:
npm run dev:backend  # Backend on http://localhost:3001
npm run dev:frontend # Frontend on http://localhost:5173
```

5. **Open your browser**

Navigate to `http://localhost:5173`

## 📦 Production Deployment

### Using Docker Compose

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Manual Deployment

#### Backend

```bash
cd backend
npm install
npm run build
npm start
```

#### Frontend

```bash
cd frontend
npm install
npm run build

# Serve the dist/ folder with nginx or any static host
```

## 🔧 Configuration

### Backend Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend server port | `3001` |
| `REDIS_HOST` | Redis hostname | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:5173` |
| `DEFAULT_SESSION_EXPIRY` | Default session expiry (seconds) | `900` |
| `MAX_SESSION_EXPIRY` | Maximum session expiry (seconds) | `3600` |

### Frontend Environment Variables

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

## 🏃 Usage

### Creating a Session

1. Visit the homepage
2. Select session expiry time (5-60 minutes)
3. Click "Create Session"
4. Share the generated URL with exactly one other person

### Joining a Session

1. Open the shared session URL
2. Wait for the other participant to join
3. Once connected, start chatting or enable voice

### Session URL Format

```
https://yourapp.com/#/s/{session_id}:{secret}
```

- `session_id`: Public identifier (UUIDv7)
- `secret`: High-entropy random value (never sent to server)

## 🛡️ Security Features

### Encryption

- **Key Exchange**: ECDH (P-256 curve) for deriving shared secrets
- **Message Encryption**: AES-GCM with 256-bit keys
- **Voice Encryption**: DTLS-SRTP (built into WebRTC)
- **Key Derivation**: Browser's WebCrypto API

### Privacy Guarantees

- Server never sees encryption keys
- Server never sees plaintext messages
- No logs of conversations
- No user tracking or analytics
- Sessions auto-delete on expiry
- No persistent storage of content

### One-to-One Enforcement

- Session store rejects 3rd participant
- Signaling service only allows 2 WebSocket connections per session
- Client crypto handshake requires exactly 2 parties

## 📁 Project Structure

```
COMAPP/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Entry point
│   │   ├── session-api.ts        # REST API for sessions
│   │   ├── session-store.ts      # Redis session management
│   │   └── signaling-service.ts  # WebSocket signaling
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── crypto.ts         # WebCrypto encryption
│   │   │   ├── webrtc.ts         # WebRTC engine
│   │   │   └── session-manager.ts # Session orchestration
│   │   ├── pages/
│   │   │   ├── Home.tsx          # Landing page
│   │   │   └── Session.tsx       # Chat interface
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
└── package.json
```

## 🔌 API Reference

### REST API

#### Create Session

```http
POST /api/sessions
Content-Type: application/json

{
  "expires_in_seconds": 900
}
```

Response:

```json
{
  "session_id": "0192f3e2-...",
  "expires_at": "2026-01-13T10:30:00Z",
  "expires_in_seconds": 900
}
```

#### Get Session Info

```http
GET /api/sessions/:id
```

#### Delete Session

```http
DELETE /api/sessions/:id
```

### WebSocket Signaling

Connect to `ws://localhost:3001/signaling`

#### Authentication

```json
{
  "type": "auth",
  "sessionId": "session-id-here"
}
```

#### Messages

- `offer` - WebRTC offer with public key
- `answer` - WebRTC answer with public key
- `ice-candidate` - ICE candidate for NAT traversal
- `ready` - Both participants connected
- `peer-left` - Other participant disconnected

## 🧪 Testing

### Manual Testing

1. Open the app in two different browsers
2. Create a session in browser A
3. Copy the URL to browser B
4. Test text messaging and voice communication

### TURN Server (for NAT traversal)

For production, configure a TURN server:

```env
TURN_URLS=turn:your-turn-server.com:3478
TURN_USERNAME=your-username
TURN_CREDENTIAL=your-credential
```

Recommended: [coturn](https://github.com/coturn/coturn)

## 🚨 Troubleshooting

### "Session not found or expired"

- Session may have expired
- Check Redis is running
- Verify session URL is complete

### "Failed to access microphone"

- Grant microphone permissions in browser
- Use HTTPS in production (required for getUserMedia)

### WebRTC connection fails

- Check firewall settings
- Configure TURN server for NAT traversal
- Verify STUN servers are accessible

### Messages not encrypting/decrypting

- Ensure both clients completed key exchange
- Check browser console for crypto errors
- Verify WebCrypto API is available (HTTPS required in production)

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## ⚠️ Production Considerations

### Required for Production

- [ ] Use HTTPS (required for WebCrypto and getUserMedia)
- [ ] Configure TURN server for reliable NAT traversal
- [ ] Set up proper CORS headers
- [ ] Configure Redis persistence/backup strategy
- [ ] Implement rate limiting on session creation
- [ ] Add monitoring and logging (without logging content)
- [ ] Set up CDN for frontend assets
- [ ] Configure security headers (helmet.js)

### Optional Enhancements

- [ ] Add session password protection
- [ ] Implement reconnection logic
- [ ] Add file sharing via data channels
- [ ] Support for screen sharing
- [ ] Mobile app versions (React Native)
- [ ] Multi-language support
- [ ] Custom TURN server deployment

## 📚 Additional Resources

- [WebRTC API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [TURN Server Setup Guide](https://github.com/coturn/coturn)

---

Built with privacy and security as first-class principles. 🔒
