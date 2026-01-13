import { useState } from 'react';
import { SessionManager } from '../lib/session-manager';
import './Home.css';

function Home() {
  const [loading, setLoading] = useState(false);
  const [sessionUrl, setSessionUrl] = useState('');
  const [expiryMinutes, setExpiryMinutes] = useState(15);

  const handleCreateSession = async () => {
    setLoading(true);
    try {
      const manager = new SessionManager();
      const url = await manager.createSession(expiryMinutes * 60);
      setSessionUrl(url);
    } catch (error) {
      console.error('Failed to create session:', error);
      alert('Failed to create session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(sessionUrl);
    alert('Link copied to clipboard!');
  };

  return (
    <div className="home">
      <div className="home-container">
        <header className="home-header">
          <h1>🔒 Ephemeral Chat</h1>
          <p className="tagline">Private. Encrypted. Ephemeral.</p>
        </header>

        <div className="features">
          <div className="feature">
            <div className="feature-icon">🔐</div>
            <h3>End-to-End Encrypted</h3>
            <p>Your messages are encrypted on your device. Nobody else can read them.</p>
          </div>
          <div className="feature">
            <div className="feature-icon">👥</div>
            <h3>One-to-One Only</h3>
            <p>Exactly two people. No more, no less. Technically enforced.</p>
          </div>
          <div className="feature">
            <div className="feature-icon">⏱️</div>
            <h3>Self-Destructing</h3>
            <p>Sessions expire automatically. No traces left behind.</p>
          </div>
          <div className="feature">
            <div className="feature-icon">🚫</div>
            <h3>No Accounts</h3>
            <p>No signup, no login, no tracking. Pure privacy.</p>
          </div>
        </div>

        {!sessionUrl ? (
          <div className="create-session">
            <h2>Create a New Session</h2>
            <div className="form-group">
              <label htmlFor="expiry">Session expires in:</label>
              <select
                id="expiry"
                value={expiryMinutes}
                onChange={(e) => setExpiryMinutes(Number(e.target.value))}
                disabled={loading}
              >
                <option value={5}>5 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
              </select>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleCreateSession}
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Session'}
            </button>
          </div>
        ) : (
          <div className="session-created">
            <h2>✅ Session Created!</h2>
            <p className="info-text">
              Share this link with exactly one person. The link contains the encryption
              key - keep it safe!
            </p>
            <div className="url-box">
              <input
                type="text"
                value={sessionUrl}
                readOnly
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button className="btn btn-secondary" onClick={handleCopyUrl}>
                Copy
              </button>
            </div>
            <div className="actions">
              <a href={sessionUrl} className="btn btn-primary">
                Join Session
              </a>
              <button
                className="btn btn-outline"
                onClick={() => setSessionUrl('')}
              >
                Create Another
              </button>
            </div>
          </div>
        )}

        <footer className="home-footer">
          <div className="security-notice">
            <h3>🛡️ How It Works</h3>
            <ul>
              <li>Your browser generates encryption keys locally</li>
              <li>Messages are encrypted before leaving your device</li>
              <li>The server only relays encrypted data - it cannot decrypt</li>
              <li>Sessions self-destruct after expiry or disconnect</li>
              <li>No logs, no history, no metadata collection</li>
            </ul>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default Home;
