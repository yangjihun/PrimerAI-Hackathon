import { PLANS, formatPrice, type PlanType } from "../../../shared/lib/subscription";
import { createPortal } from "react-dom";

interface PlanModalProps {
  currentPlan: PlanType;
  onClose: () => void;
  onPlanChange: (planId: PlanType) => void;
}

export function PlanModal({ currentPlan, onClose, onPlanChange }: PlanModalProps) {
  const modal = (
    <div className="plan-modal-overlay" onClick={onClose}>
      <div className="plan-modal" onClick={(e) => e.stopPropagation()}>
        <div className="plan-modal-header">
          <h2 className="plan-modal-title">요금제 선택</h2>
          <button className="plan-modal-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>

        <div className="plan-modal-content">
          <div className="plan-current">
            <p className="plan-current-label">현재 요금제</p>
            <p className="plan-current-name">{PLANS[currentPlan].name}</p>
            <p className="plan-current-price">
              {PLANS[currentPlan].price === 0
                ? "무료"
                : `${formatPrice(PLANS[currentPlan].price)}/월`}
            </p>
          </div>

          <div className="plan-list">
            {Object.values(PLANS).map((plan) => {
              const isCurrent = plan.id === currentPlan;
              return (
                <div
                  key={plan.id}
                  className={`plan-card ${isCurrent ? "plan-card-current" : ""}`}
                >
                  {isCurrent && <div className="plan-badge">현재</div>}
                  <h3 className="plan-name">{plan.name}</h3>
                  <div className="plan-price">
                    {plan.price === 0 ? (
                      <span className="plan-price-free">무료</span>
                    ) : (
                      <>
                        <span className="plan-price-amount">{formatPrice(plan.price)}</span>
                        <span className="plan-price-period">/월</span>
                      </>
                    )}
                  </div>
                  <p className="plan-description">{plan.description}</p>
                  <ul className="plan-features">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="plan-feature">
                        <span className="plan-feature-icon">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        <div className="plan-modal-footer">
          <div className="plan-footer-buttons">
            {Object.values(PLANS).map((plan) => {
              const isCurrent = plan.id === currentPlan;
              return (
                <button
                  key={plan.id}
                  className={`plan-select-btn ${isCurrent ? "plan-select-btn-current" : ""}`}
                  onClick={() => onPlanChange(plan.id)}
                  disabled={isCurrent}
                >
                  {isCurrent ? "현재 요금제" : "선택하기"}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return modal;
  }

  return createPortal(modal, document.body);
}

