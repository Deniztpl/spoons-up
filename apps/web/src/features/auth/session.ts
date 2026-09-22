export type AuthStatus = "checking" | "authenticated" | "unauthenticated";

let accessToken: string | null = null;
let authStatus: AuthStatus = "checking";
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function getAccessToken() {
  return accessToken;
}

export function getAuthStatus() {
  return authStatus;
}

export function subscribeToAuth(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setAuthenticated(token: string) {
  accessToken = token;
  authStatus = "authenticated";
  emitChange();
}

export function setUnauthenticated() {
  accessToken = null;
  authStatus = "unauthenticated";
  emitChange();
}

export function setAuthChecking() {
  accessToken = null;
  authStatus = "checking";
  emitChange();
}
