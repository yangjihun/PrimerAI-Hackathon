import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Title } from "../../../shared/types/netplus";
import { listTitles } from "../../../shared/api/netplus";

export function BrowsePage() {
  const [titles, setTitles] = useState<Title[]>([]);
  const [loading, setLoading] = useState(true);
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
        <section className="browse-section">
          <h2 className="browse-section-title">인기 작품</h2>
          <div className="browse-grid">
            {titles.map((title) => (
              <div
                key={title.id}
                className="browse-card"
                onClick={() => handleTitleClick(title.id)}
              >
                <div className="browse-card-image">
                  <div className="browse-card-placeholder">
                    {title.name.charAt(0)}
                  </div>
                </div>
                <div className="browse-card-info">
                  <h3 className="browse-card-title">{title.name}</h3>
                  <p className="browse-card-description">{title.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="browse-section">
          <h2 className="browse-section-title">추천 작품</h2>
          <div className="browse-grid">
            {titles.slice(0, 4).map((title) => (
              <div
                key={title.id}
                className="browse-card"
                onClick={() => handleTitleClick(title.id)}
              >
                <div className="browse-card-image">
                  <div className="browse-card-placeholder">
                    {title.name.charAt(0)}
                  </div>
                </div>
                <div className="browse-card-info">
                  <h3 className="browse-card-title">{title.name}</h3>
                  <p className="browse-card-description">{title.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

