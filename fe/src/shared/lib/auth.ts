/**
 * 간단한 인증 상태 관리 (Mock)
 * 실제 서비스에서는 JWT 토큰, 세션 등을 사용
 */

export interface User {
  id: string;
  email: string;
  name: string;
}

const STORAGE_KEY = "netplus_user";

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : null;
}

export function setCurrentUser(user: User | null): void {
  if (typeof window === "undefined") return;
  if (user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function isAuthenticated(): boolean {
  return getCurrentUser() !== null;
}

export function logout(): void {
  setCurrentUser(null);
}

