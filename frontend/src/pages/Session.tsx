import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SessionManager, SessionInfo } from '../lib/session-manager';
import './Session.css';

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'peer';
  timestamp: number;
}

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'failed';

function Session() {
  const { sessionData } = useParams<{ sessionData: string }>();
  const navigate = useNavigate();
  const [manager] = useState(() => new SessionManager());
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [voiceActive, setVoiceActive] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const isInitializing = useRef(false);

  useEffect(() => {
    if (!sessionData) {
      navigate('/');
      return;
    }

    const sessionInfo = SessionManager.parseSessionUrl(sessionData);
    if (!sessionInfo) {
      setError('Invalid session URL');
      setConnectionState('failed');
      return;
    }

    // Prevent double initialization
    if (isInitializing.current) {
      return;
    }
    isInitializing.current = true;

    // Small delay to allow previous connections to clean up
    const timer = setTimeout(() => {
      initializeSession(sessionInfo);
    }, 100);

    return () => {
      clearTimeout(timer);
      isInitializing.current = false;
      manager.cleanup();
    };
  }, [sessionData]);

  useEffect(() => {
    // Play remote audio stream
    if (remoteStream && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeSession = async (sessionInfo: SessionInfo) => {
    try {
      await manager.joinSession(sessionInfo, {
        onReady: () => {
          console.log('Session ready');
        },
        onMessage: (message) => {
          addMessage(message, 'peer');
        },
        onRemoteStream: (stream) => {
          setRemoteStream(stream);
        },
        onPeerLeft: () => {
          setError('Peer has left the session');
          setConnectionState('disconnected');
        },
        onError: (err) => {
          console.error('Session error:', err);
          // Normalize error message
          const errorMsg = err.toLowerCase();
          if (errorMsg.includes('expired')) {
            setError('Session expired');
          } else if (errorMsg.includes('full')) {
            setError('Session is full (maximum 2 participants)');
          } else if (errorMsg.includes('not found')) {
            setError('Session expired or not found');
          } else {
            setError(err);
          }
          setConnectionState('failed');
        },
        onConnectionStateChange: (state) => {
          if (state === 'connected') {
            setConnectionState('connected');
          } else if (state === 'failed' || state === 'closed') {
            setConnectionState('failed');
          }
        },
      });

      setConnectionState('connected');
    } catch (err) {
      console.error('Failed to join session:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to join session';
      setError(errorMessage);
      setConnectionState('failed');
    }
  };

  const addMessage = (text: string, sender: 'me' | 'peer') => {
    const message: Message = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      sender,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, message]);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    try {
      await manager.sendMessage(inputText);
      addMessage(inputText, 'me');
      setInputText('');
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleVoice = async () => {
    try {
      if (voiceActive) {
        manager.stopVoice();
        setVoiceActive(false);
      } else {
        await manager.startVoice();
        setVoiceActive(true);
      }
    } catch (err) {
      console.error('Voice error:', err);
      setError('Failed to access microphone');
    }
  };

  const handleLeave = () => {
    if (confirm('Are you sure you want to leave this session?')) {
      manager.cleanup();
      navigate('/');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (error && connectionState === 'failed') {
    return (
      <div className="session session-error">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h2>Connection Error</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="session">
      <audio ref={remoteAudioRef} autoPlay />

      <header className="session-header">
        <div className="header-left">
          <h1>🔒 Secure Session</h1>
          <div className="connection-status">
            <span
              className={`status-indicator ${connectionState}`}
            ></span>
            <span className="status-text">
              {connectionState === 'connecting' && 'Connecting...'}
              {connectionState === 'connected' && 'Connected'}
              {connectionState === 'disconnected' && 'Disconnected'}
              {connectionState === 'failed' && 'Failed'}
            </span>
          </div>
        </div>
        <button className="btn btn-danger" onClick={handleLeave}>
          Leave
        </button>
      </header>

      <div className="session-content">
        <div className="messages-container">
          {messages.length === 0 && connectionState === 'connected' && (
            <div className="empty-state">
              <p>🔐 End-to-end encrypted session</p>
              <p>Send a message to start chatting</p>
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.sender === 'me' ? 'message-sent' : 'message-received'}`}
            >
              <div className="message-content">{message.text}</div>
              <div className="message-time">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-container">
          <button
            className={`btn btn-voice ${voiceActive ? 'active' : ''}`}
            onClick={toggleVoice}
            disabled={connectionState !== 'connected'}
            title={voiceActive ? 'Stop voice' : 'Start voice'}
          >
            {voiceActive ? '🎤' : '🔇'}
          </button>
          <textarea
            className="message-input"
            placeholder="Type a message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={connectionState !== 'connected'}
            rows={1}
          />
          <button
            className="btn btn-send"
            onClick={handleSendMessage}
            disabled={!inputText.trim() || connectionState !== 'connected'}
          >
            Send
          </button>
        </div>
      </div>

      {error && (
        <div className="toast toast-error">
          {error}
        </div>
      )}
    </div>
  );
}

export default Session;
