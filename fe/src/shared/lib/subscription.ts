/**
 * 요금제 관리 (Mock - 데모용)
 */

export type PlanType = "free" | "basic" | "premium";

export interface SubscriptionPlan {
  id: PlanType;
  name: string;
  price: number;
  features: string[];
  description: string;
}

export const PLANS: Record<PlanType, SubscriptionPlan> = {
  free: {
    id: "free",
    name: "무료",
    price: 0,
    features: [
      "기본 시청 기능",
      "일일 1시간 시청 제한",
      "광고 포함",
    ],
    description: "제한된 기능으로 시작하세요",
  },
  basic: {
    id: "basic",
    name: "베이직",
    price: 9_900,
    features: [
      "무제한 시청",
      "광고 없음",
      "표준 화질",
      "NetPlus 기본 기능",
    ],
    description: "일반 시청자에게 적합",
  },
  premium: {
    id: "premium",
    name: "프리미엄",
    price: 14_900,
    features: [
      "무제한 시청",
      "광고 없음",
      "고화질 (4K)",
      "NetPlus 모든 기능",
      "동시 시청 4개 기기",
      "오프라인 다운로드",
    ],
    description: "최고의 시청 경험",
  },
};

const STORAGE_KEY = "netplus_subscription";

export function getCurrentPlan(): PlanType {
  if (typeof window === "undefined") return "free";
  const stored = localStorage.getItem(STORAGE_KEY);
  return (stored as PlanType) || "free";
}

export function setCurrentPlan(plan: PlanType): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, plan);
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
  }).format(price);
}

