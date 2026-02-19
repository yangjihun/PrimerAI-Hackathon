import { AUTH_TOKEN_STORAGE_KEY, ApiError, apiRequest } from "../api/http";

export interface User {
  id: string;
  email: string;
  name: string;
  created_at?: string | null;
}

interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

interface LoginPayload {
  email: string;
  password: string;
}

interface SignupPayload {
  name: string;
  email: string;
  password: string;
}

const USER_STORAGE_KEY = "netplus_user";
const AUTH_CHANGED_EVENT = "netplus-auth-changed";
const GUEST_TOKEN = "netplus_guest_access_token";

function emitAuthChanged(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function subscribeAuthChanged(handler: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const wrapped = () => handler();
  window.addEventListener(AUTH_CHANGED_EVENT, wrapped);
  window.addEventListener("storage", wrapped);
  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, wrapped);
    window.removeEventListener("storage", wrapped);
  };
}

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(USER_STORAGE_KEY);
  if (!stored) {
    return null;
  }
  try {
    return JSON.parse(stored) as User;
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export function setCurrentUser(user: User | null): void {
  if (typeof window === "undefined") return;
  if (user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
  emitAuthChanged();
}

function setAccessToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  }
}

function applyAuthSession(response: AuthResponse): User {
  setAccessToken(response.access_token);
  setCurrentUser(response.user);
  return response.user;
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken()) && Boolean(getCurrentUser());
}

export async function signupWithBackend(payload: SignupPayload): Promise<User> {
  const response = await apiRequest<AuthResponse>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return applyAuthSession(response);
}

export async function loginWithBackend(payload: LoginPayload): Promise<User> {
  const response = await apiRequest<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return applyAuthSession(response);
}

export async function refreshMe(): Promise<User | null> {
  const token = getAccessToken();
  if (!token) {
    return null;
  }

  try {
    const user = await apiRequest<User>("/api/auth/me");
    setCurrentUser(user);
    return user;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      logout();
      return null;
    }
    throw error;
  }
}

export function logout(): void {
  setAccessToken(null);
  setCurrentUser(null);
  emitAuthChanged();
}

export function continueAsGuest(): User {
  const guestUser: User = {
    id: "guest-user",
    email: "guest@netplus.local",
    name: "Guest",
    created_at: null,
  };
  setAccessToken(GUEST_TOKEN);
  setCurrentUser(guestUser);
  return guestUser;
}
