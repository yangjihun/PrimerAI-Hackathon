import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  getCurrentUser,
  isAuthenticated,
  logout,
  refreshMe,
  subscribeAuthChanged,
  type User,
} from "../../../shared/lib/auth";
import { getCurrentPlan, setCurrentPlan as savePlan, PLANS, formatPrice, type PlanType } from "../../../shared/lib/subscription";
import { PlanModal } from "./PlanModal";
import { useState, useEffect } from "react";

export function Header() {
  const [user, setUser] = useState<User | null>(getCurrentUser());
  const [showMenu, setShowMenu] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<PlanType>(getCurrentPlan());
  const navigate = useNavigate();

  useEffect(() => {
    const sync = () => setUser(getCurrentUser());
    const unsubscribe = subscribeAuthChanged(sync);

    if (isAuthenticated() && !getCurrentUser()) {
      void refreshMe().finally(sync);
    } else {
      sync();
    }

    return unsubscribe;
  }, []);

  const handleLogout = () => {
    logout();
    setShowMenu(false);
    navigate("/login", { replace: true });
  };

  const handlePlanChange = (planId: PlanType) => {
    setCurrentPlan(planId); // 상태 업데이트
    savePlan(planId); // localStorage에 저장
    setShowPlanModal(false);
    // 실제로는 결제 프로세스 진행
    alert(`${PLANS[planId].name} 요금제로 변경되었습니다! (데모)`);
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <Link to="/browse" className="header-logo">
          NetPlus
        </Link>
      </div>
      <div className="header-right">
        {isAuthenticated() && user && (
          <button
            className="header-plan-btn"
            onClick={() => setShowPlanModal(true)}
            aria-label="요금제"
          >
            <span className="header-plan-badge">{PLANS[currentPlan].name}</span>
            <span className="header-plan-text">요금제</span>
          </button>
        )}
        {isAuthenticated() && user ? (
          <div className="header-user-menu">
            <button
              className="header-profile-btn"
              onClick={() => setShowMenu((prev) => !prev)}
              aria-label="Profile menu"
            >
              <span className="header-profile-icon">U</span>
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
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link to="/login" className="header-login-btn">
            Login
          </Link>
        )}
      </div>

      {showPlanModal && (
        <PlanModal
          currentPlan={currentPlan}
          onClose={() => setShowPlanModal(false)}
          onPlanChange={handlePlanChange}
        />
      )}
    </header>
  );
}
