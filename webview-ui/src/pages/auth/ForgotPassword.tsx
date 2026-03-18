import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './auth.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    // Note: Password reset endpoint not implemented in backend yet
    // This is a placeholder for future implementation
    setTimeout(() => {
      setMessage('If your email exists in our system, you will receive a password reset link shortly.');
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>🔑 Forgot Password</h1>
        <p className="auth-subtitle">Enter your email to reset your password</p>

        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="auth-footer">
          <span>Remember your password?</span>
          <button onClick={() => navigate('/auth/login')} className="link-btn">
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
