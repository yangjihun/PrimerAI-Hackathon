/**
 * Subscription management (local mock).
 */

export type PlanType = "free" | "basic" | "premium";

export interface SubscriptionPlan {
  id: PlanType;
  name: string;
  price: number;
  features: string[];
  description: string;
}

const PLAN_STORAGE_KEY = "netplus_subscription";
const PLAN_CHANGED_EVENT = "netplus-plan-changed";
const FREE_AI_TRIAL_STORAGE_KEY = "netplus_free_ai_trial_used";
const FREE_SELECTED_TITLE_STORAGE_KEY = "netplus_free_selected_title_id";
const FREE_AI_TRIAL_LIMIT = 3;
const FREE_WATCHABLE_TITLES_LIMIT = 1;

function emitPlanChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PLAN_CHANGED_EVENT));
}

export function subscribePlanChanged(handler: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const wrapped = () => handler();
  window.addEventListener(PLAN_CHANGED_EVENT, wrapped);
  window.addEventListener("storage", wrapped);
  return () => {
    window.removeEventListener(PLAN_CHANGED_EVENT, wrapped);
    window.removeEventListener("storage", wrapped);
  };
}

export const PLANS: Record<PlanType, SubscriptionPlan> = {
  free: {
    id: "free",
    name: "무료",
    price: 0,
    features: [
      "작품 1개 시청 가능",
      "AI 무료 체험 3회",
      "광고 포함",
    ],
    description: "무료로 시작하고 핵심 기능을 체험해보세요.",
  },
  basic: {
    id: "basic",
    name: "베이직",
    price: 9_900,
    features: [
      "무제한 시청",
      "AI 어시스턴트 무제한",
      "AI 리캡 생성 무제한",
      "AI Q&A 채팅 무제한",
      "광고 없음",
      "일반 화질",
    ],
    description: "일반 시청자에게 적합한 요금제입니다.",
  },
  premium: {
    id: "premium",
    name: "프리미엄",
    price: 14_900,
    features: [
      "무제한 시청",
      "AI 어시스턴트 무제한",
      "고급 AI 리캡 모드",
      "AI 응답 우선 처리",
      "인물 관계 AI 인사이트",
      "광고 없음",
      "4K 화질",
      "최대 4대 동시 시청",
      "오프라인 다운로드",
    ],
    description: "최고 수준의 시청 및 AI 경험을 제공합니다.",
  },
};

export interface AiUsageStatus {
  isUnlimited: boolean;
  used: number;
  limit: number | null;
  remaining: number | null;
}

export function getCurrentPlan(): PlanType {
  if (typeof window === "undefined") return "free";
  const stored = localStorage.getItem(PLAN_STORAGE_KEY) as PlanType | null;
  if (stored === "free" || stored === "basic" || stored === "premium") {
    return stored;
  }
  return "free";
}

export function setCurrentPlan(plan: PlanType): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PLAN_STORAGE_KEY, plan);
  emitPlanChanged();
}

function getFreeAiUsedCount(): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(FREE_AI_TRIAL_STORAGE_KEY);
  const parsed = Number.parseInt(raw ?? "0", 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function setFreeAiUsedCount(nextCount: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(FREE_AI_TRIAL_STORAGE_KEY, String(Math.max(0, nextCount)));
}

export function getAiUsageStatus(): AiUsageStatus {
  const plan = getCurrentPlan();
  if (plan !== "free") {
    return {
      isUnlimited: true,
      used: 0,
      limit: null,
      remaining: null,
    };
  }

  const used = getFreeAiUsedCount();
  const remaining = Math.max(FREE_AI_TRIAL_LIMIT - used, 0);
  return {
    isUnlimited: false,
    used,
    limit: FREE_AI_TRIAL_LIMIT,
    remaining,
  };
}

export function consumeAiUsage(): { allowed: boolean; status: AiUsageStatus } {
  const plan = getCurrentPlan();
  if (plan !== "free") {
    return {
      allowed: true,
      status: getAiUsageStatus(),
    };
  }

  const used = getFreeAiUsedCount();
  if (used >= FREE_AI_TRIAL_LIMIT) {
    return {
      allowed: false,
      status: getAiUsageStatus(),
    };
  }

  setFreeAiUsedCount(used + 1);
  return {
    allowed: true,
    status: getAiUsageStatus(),
  };
}

export function getWatchableTitlesLimit(): number | null {
  const plan = getCurrentPlan();
  if (plan === "free") {
    return FREE_WATCHABLE_TITLES_LIMIT;
  }
  return null;
}

export function canWatchTitleByIndex(index: number): boolean {
  const limit = getWatchableTitlesLimit();
  if (limit === null) {
    return true;
  }
  return index >= 0 && index < limit;
}

export function getFreeSelectedTitleId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(FREE_SELECTED_TITLE_STORAGE_KEY);
}

function setFreeSelectedTitleId(titleId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(FREE_SELECTED_TITLE_STORAGE_KEY, titleId);
}

export function canWatchTitleById(titleId: string): boolean {
  if (getCurrentPlan() !== "free") {
    return true;
  }
  const selected = getFreeSelectedTitleId();
  if (!selected) {
    return true;
  }
  return selected === titleId;
}

export function lockFreeTitleSelection(titleId: string): {
  allowed: boolean;
  selectedTitleId: string;
  newlySelected: boolean;
} {
  if (getCurrentPlan() !== "free") {
    return {
      allowed: true,
      selectedTitleId: titleId,
      newlySelected: false,
    };
  }

  const selected = getFreeSelectedTitleId();
  if (!selected) {
    setFreeSelectedTitleId(titleId);
    return {
      allowed: true,
      selectedTitleId: titleId,
      newlySelected: true,
    };
  }

  return {
    allowed: selected === titleId,
    selectedTitleId: selected,
    newlySelected: false,
  };
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
  }).format(price);
}
