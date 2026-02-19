import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ApiError } from "../../../shared/api/http";
import { continueAsGuest, signupWithBackend } from "../../../shared/lib/auth";

export function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      await signupWithBackend({ name, email, password });
      navigate("/browse", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Signup failed. Please try again.");
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
          <p className="auth-subtitle">Create your account</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          <div className="auth-field">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter your name"
              required
              disabled={loading}
            />
          </div>

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
              minLength={8}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="confirmPassword">Confirm password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Enter password again"
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Signing up..." : "Sign up"}
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
            Already have an account? <Link to="/login" className="auth-link">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
