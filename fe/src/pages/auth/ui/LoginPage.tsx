import { FormEvent, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { setCurrentUser } from "../../../shared/lib/auth";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Mock 로그인 (실제로는 API 호출)
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (email && password) {
      // 간단한 검증 (실제로는 서버에서 처리)
      setCurrentUser({
        id: "user-1",
        email,
        name: email.split("@")[0],
      });
      navigate("/browse");
    } else {
      setError("이메일과 비밀번호를 입력해주세요.");
    }

    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1 className="auth-logo">NetPlus</h1>
          <p className="auth-subtitle">로그인하여 계속하세요</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          <div className="auth-field">
            <label htmlFor="email">이메일</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일을 입력하세요"
              required
              disabled={loading}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            계정이 없으신가요?{" "}
            <Link to="/signup" className="auth-link">
              회원가입
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

