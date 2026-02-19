import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { listTitles } from "../../../shared/api/netplus";
import {
  canWatchTitleById,
  getCurrentPlan,
  lockFreeTitleSelection,
  subscribePlanChanged,
  type PlanType,
} from "../../../shared/lib/subscription";
import type { Title } from "../../../shared/types/netplus";

const MEMBERSHIP_BENEFITS = [
  {
    title: "모든 콘텐츠 자유 시청",
    description:
      "무료 플랜은 1개 작품만 시청할 수 있어요. 업그레이드하면 원하는 작품을 제한 없이 감상할 수 있어요.",
  },
  {
    title: "AI 기능 무제한 사용",
    description:
      "무료 플랜의 AI 체험 횟수 제한 없이, 질문/요약/관계 분석 기능을 계속 사용할 수 있어요.",
  },
  {
    title: "광고 없이 몰입",
    description:
      "중간 방해 없이 콘텐츠에 집중할 수 있어요. 연속 시청할수록 체감이 커집니다.",
  },
  {
    title: "고화질 + 동시 시청",
    description:
      "더 높은 화질과 더 많은 동시 시청 환경으로 가족/친구와 함께 쓰기 좋아요.",
  },
];

export function BrowsePage() {
  const [titles, setTitles] = useState<Title[]>([]);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<PlanType>(() => getCurrentPlan());
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

    void loadTitles();
  }, []);

  useEffect(() => {
    const syncPlan = () => setPlan(getCurrentPlan());
    return subscribePlanChanged(syncPlan);
  }, []);

  const handleTitleClick = (titleId: string) => {
    const locked = lockFreeTitleSelection(titleId);
    if (!locked.allowed) {
      alert(
        "무료 플랜은 처음 선택한 1개 작품만 시청할 수 있어요. 다른 작품을 보려면 요금제를 업그레이드해 주세요.",
      );
      return;
    }

    navigate(`/watch?titleId=${titleId}`);
  };

  const handleMembershipCtaClick = () => {
    const section = document.getElementById("membership-upsell");
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    alert("상단 헤더의 요금제 버튼에서 업그레이드를 진행할 수 있어요.");
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
          <p className="browse-hero-subtitle">보고 있는 순간을 더 똑똑하게 즐기는 시청 경험</p>
        </div>
      </div>

      <div className="browse-content">
        {plan === "free" && (
          <section className="browse-membership-banner" aria-label="membership upsell">
            <div className="browse-membership-banner-icon" aria-hidden>
              🍿
            </div>
            <div className="browse-membership-banner-copy">
              <h3 className="browse-membership-banner-title">월 9,900원으로 더 넓게 즐기는 NetPlus</h3>
              <p className="browse-membership-banner-text">
                작품 선택 제한 없이, AI 기능까지 넉넉하게 이용할 수 있는 멤버십을 시작해 보세요.
              </p>
            </div>
            <button
              type="button"
              className="browse-membership-banner-cta"
              onClick={handleMembershipCtaClick}
            >
              자세히 알아보기
            </button>
          </section>
        )}

        <section className="browse-section">
          <h2 className="browse-section-title">지금 뜨는 콘텐츠</h2>
          <div className="browse-trending-row">
            {titles.slice(0, 10).map((title, idx) => {
              const locked = !canWatchTitleById(title.id);
              return (
                <button
                  key={title.id}
                  className={`browse-trending-card ${locked ? "browse-card-locked" : ""}`}
                  onClick={() => handleTitleClick(title.id)}
                  type="button"
                >
                  <span className="browse-trending-rank">{idx + 1}</span>
                  <div className="browse-trending-image-wrap">
                    {title.thumbnail_url ? (
                      <img
                        src={title.thumbnail_url}
                        alt={title.name}
                        className="browse-trending-thumbnail"
                        loading="lazy"
                      />
                    ) : (
                      <div className="browse-card-placeholder">{title.name.charAt(0)}</div>
                    )}
                    <div className="browse-trending-name">{title.name}</div>
                    {locked && <div className="browse-card-lock">선택 작품 외 잠금</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {plan === "free" && (
          <section
            id="membership-upsell"
            className="browse-section browse-membership-section"
          >
            <h2 className="browse-section-title">가입해야 하는 또 다른 이유</h2>
            <p className="browse-membership-subtitle">
              지금은 무료 회원이므로 일부 기능이 제한되어 있습니다. 업그레이드하면 아래 혜택을 모두 사용할 수 있어요.
            </p>
            <div className="browse-membership-grid">
              {MEMBERSHIP_BENEFITS.map((benefit) => (
                <article key={benefit.title} className="browse-membership-card">
                  <h3 className="browse-membership-title">{benefit.title}</h3>
                  <p className="browse-membership-description">{benefit.description}</p>
                </article>
              ))}
            </div>
            <p className="browse-membership-help">
              업그레이드는 상단 헤더의 <strong>요금제</strong> 버튼에서 진행할 수 있습니다.
            </p>
          </section>
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
                      <div className="browse-card-placeholder">{title.name.charAt(0)}</div>
                    )}
                    {locked && <div className="browse-card-lock">선택 작품 외 잠금</div>}
                  </div>
                  <div className="browse-card-info">
                    <h3 className="browse-card-title">{title.name}</h3>
                    <p className="browse-card-description">{title.description}</p>
                  </div>
                </div>
              );
            })}
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
                      <div className="browse-card-placeholder">{title.name.charAt(0)}</div>
                    )}
                    {locked && <div className="browse-card-lock">선택 작품 외 잠금</div>}
                  </div>
                  <div className="browse-card-info">
                    <h3 className="browse-card-title">{title.name}</h3>
                    <p className="browse-card-description">{title.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
