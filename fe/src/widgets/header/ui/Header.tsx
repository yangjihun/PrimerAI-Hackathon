import { Link, useNavigate } from "react-router-dom";
import { getCurrentUser, logout, isAuthenticated } from "../../../shared/lib/auth";
import { useState, useEffect } from "react";

export function Header() {
  const [user, setUser] = useState(getCurrentUser());
  const [showMenu, setShowMenu] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // 인증 상태 변경 감지
    const checkAuth = () => {
      setUser(getCurrentUser());
    };
    window.addEventListener("storage", checkAuth);
    checkAuth();
    return () => window.removeEventListener("storage", checkAuth);
  }, []);

  const handleLogout = () => {
    logout();
    setUser(null);
    setShowMenu(false);
    navigate("/login");
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <Link to="/browse" className="header-logo">
          NetPlus
        </Link>
      </div>
      <div className="header-right">
        {isAuthenticated() && user ? (
          <div className="header-user-menu">
            <button
              className="header-profile-btn"
              onClick={() => setShowMenu(!showMenu)}
              aria-label="프로필 메뉴"
            >
              <span className="header-profile-icon">👤</span>
              <span className="header-profile-name">{user.name}</span>
            </button>
            {showMenu && (
              <div className="header-dropdown">
                <div className="header-dropdown-item">
                  <span className="header-dropdown-email">{user.email}</span>
                </div>
                <button
                  className="header-dropdown-item header-dropdown-button"
                  onClick={handleLogout}
                >
                  로그아웃
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link to="/login" className="header-login-btn">
            로그인
          </Link>
        )}
        <button className="header-search-btn" aria-label="검색">
          🔍
        </button>
      </div>
    </header>
  );
}

