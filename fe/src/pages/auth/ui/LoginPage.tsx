import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ApiError } from "../../../shared/api/http";
import { continueAsGuest, loginWithBackend } from "../../../shared/lib/auth";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await loginWithBackend({ email, password });
      navigate("/browse", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuestContinue = () => {
    continueAsGuest();
    navigate("/browse", { replace: true });
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1 className="auth-logo">NetPlus</h1>
          <p className="auth-subtitle">Log in to continue</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email"
              required
              disabled={loading}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Logging in..." : "Log in"}
          </button>
          <button
            type="button"
            className="auth-submit auth-submit-secondary"
            onClick={handleGuestContinue}
            disabled={loading}
          >
            Continue as guest
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Need an account? <Link to="/signup" className="auth-link">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
