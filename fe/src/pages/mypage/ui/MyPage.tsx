import { useState } from "react";
import { getCurrentUser, logout } from "../../../shared/lib/auth";
import type { ResponseStyle } from "../../../shared/types/netplus";
import { useNavigate } from "react-router-dom";

const CHAT_STYLE_STORAGE_KEY = "netplus_chat_response_style";

const STYLE_OPTIONS: Array<{ value: ResponseStyle; label: string; description: string }> = [
  { value: "FRIEND", label: "Friend", description: "친근하고 편한 말투" },
  { value: "ASSISTANT", label: "Assistant", description: "간결하고 정돈된 비서 톤" },
  { value: "CRITIC", label: "Film Critic", description: "작품 분석 중심의 평론가 톤" },
];

function getInitialStyle(): ResponseStyle {
  if (typeof window === "undefined") return "FRIEND";
  const saved = localStorage.getItem(CHAT_STYLE_STORAGE_KEY);
  if (saved === "FRIEND" || saved === "ASSISTANT" || saved === "CRITIC") return saved;
  return "FRIEND";
}

export function MyPage() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [style, setStyle] = useState<ResponseStyle>(getInitialStyle);
  const [draftStyle, setDraftStyle] = useState<ResponseStyle>(style);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleStyleChange = (value: string) => {
    if (value !== "FRIEND" && value !== "ASSISTANT" && value !== "CRITIC") return;
    setDraftStyle(value);
  };

  const handleApplyStyle = () => {
    setStyle(draftStyle);
    if (typeof window !== "undefined") {
      localStorage.setItem(CHAT_STYLE_STORAGE_KEY, draftStyle);
    }
    setToastMessage("반영되었습니다.");
    window.setTimeout(() => setToastMessage(null), 2200);
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <main className="mypage-page">
      <section className="mypage-card">
        <h1 className="mypage-title">My Page</h1>
        <p className="mypage-email">{user?.email ?? "-"}</p>
      </section>

      <section className="mypage-card">
        <h2 className="mypage-subtitle">챗봇 답변 스타일</h2>
        <select
          className="mypage-select"
          value={draftStyle}
          onChange={(e) => handleStyleChange(e.target.value)}
        >
          {STYLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="mypage-help">
          {STYLE_OPTIONS.find((option) => option.value === draftStyle)?.description}
        </p>
        <button className="mypage-apply-btn" onClick={handleApplyStyle}>
          확인
        </button>
        {style !== draftStyle && (
          <p className="mypage-pending">저장되지 않은 변경사항이 있습니다.</p>
        )}
      </section>

      <section className="mypage-card">
        <button className="mypage-logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </section>

      {toastMessage && <div className="mypage-toast">{toastMessage}</div>}
    </main>
  );
}
