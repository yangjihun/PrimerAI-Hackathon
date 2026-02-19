import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Title } from "../../../shared/types/netplus";
import { listTitles } from "../../../shared/api/netplus";
import {
  canWatchTitleById,
  getCurrentPlan,
  getFreeSelectedTitleId,
  getWatchableTitlesLimit,
  lockFreeTitleSelection,
} from "../../../shared/lib/subscription";

export function BrowsePage() {
  const [titles, setTitles] = useState<Title[]>([]);
  const [loading, setLoading] = useState(true);
  const [freeSelectedTitleId, setFreeSelectedTitleId] = useState<string | null>(
    () => getFreeSelectedTitleId(),
  );
  const plan = getCurrentPlan();
  const watchableLimit = getWatchableTitlesLimit();
  const navigate = useNavigate();

  useEffect(() => {
    async function loadTitles() {
      setLoading(true);
      try {
        const data = await listTitles();
        setTitles(data);
      } catch (error) {
        console.error("Failed to load titles:", error);
      } finally {
        setLoading(false);
      }
    }
    loadTitles();
  }, []);

  const handleTitleClick = (titleId: string) => {
    const locked = lockFreeTitleSelection(titleId);
    if (!locked.allowed) {
      alert("무료 플랜은 처음 선택한 1개 작품만 시청할 수 있어요. 요금제를 업그레이드해 주세요.");
      return;
    }
    if (locked.newlySelected) {
      setFreeSelectedTitleId(titleId);
    }
    navigate(`/watch?titleId=${titleId}`);
  };

  if (loading) {
    return (
      <div className="browse-page">
        <div className="browse-loading">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="browse-page">
      <div className="browse-hero">
        <div className="browse-hero-content">
          <h1 className="browse-hero-title">NetPlus</h1>
          <p className="browse-hero-subtitle">
            함께 보는 친구와 함께하는 시청 경험
          </p>
        </div>
      </div>

      <div className="browse-content">
        {plan === "free" && watchableLimit !== null && (
          <div className="browse-plan-note">
            {freeSelectedTitleId
              ? "무료 플랜: 선택한 1개 작품만 시청 가능, AI 무료 체험 3회"
              : "무료 플랜: 작품 1개를 선택하면 해당 작품으로 시청이 고정됩니다. (AI 무료 체험 3회)"}
          </div>
        )}
        <section className="browse-section">
          <h2 className="browse-section-title">인기 작품</h2>
          <div className="browse-grid">
            {titles.map((title) => {
              const locked = !canWatchTitleById(title.id);
              return (
              <div
                key={title.id}
                className={`browse-card ${locked ? "browse-card-locked" : ""}`}
                onClick={() => handleTitleClick(title.id)}
              >
                <div className="browse-card-image">
                  {title.thumbnail_url ? (
                    <img
                      src={title.thumbnail_url}
                      alt={title.name}
                      className="browse-card-thumbnail"
                      loading="lazy"
                    />
                  ) : (
                    <div className="browse-card-placeholder">
                      {title.name.charAt(0)}
                    </div>
                  )}
                  {locked && <div className="browse-card-lock">선택 작품 외 잠금</div>}
                </div>
                <div className="browse-card-info">
                  <h3 className="browse-card-title">{title.name}</h3>
                  <p className="browse-card-description">{title.description}</p>
                </div>
              </div>
            )})}
          </div>
        </section>

        <section className="browse-section">
          <h2 className="browse-section-title">추천 작품</h2>
          <div className="browse-grid">
            {titles.slice(0, 4).map((title) => {
              const locked = !canWatchTitleById(title.id);
              return (
              <div
                key={title.id}
                className={`browse-card ${locked ? "browse-card-locked" : ""}`}
                onClick={() => handleTitleClick(title.id)}
              >
                <div className="browse-card-image">
                  {title.thumbnail_url ? (
                    <img
                      src={title.thumbnail_url}
                      alt={title.name}
                      className="browse-card-thumbnail"
                      loading="lazy"
                    />
                  ) : (
                    <div className="browse-card-placeholder">
                      {title.name.charAt(0)}
                    </div>
                  )}
                  {locked && <div className="browse-card-lock">선택 작품 외 잠금</div>}
                </div>
                <div className="browse-card-info">
                  <h3 className="browse-card-title">{title.name}</h3>
                  <p className="browse-card-description">{title.description}</p>
                </div>
              </div>
            )})}
          </div>
        </section>
      </div>
    </div>
  );
}

