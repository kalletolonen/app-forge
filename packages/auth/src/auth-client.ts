import { createAuthClient } from "better-auth/react";

export function createAppAuthClient(baseURL: string) {
  return createAuthClient({
    baseURL,
  });
}

export function browserAuthBaseURL(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://127.0.0.1:43123";
}

export function createBrowserAuthClient() {
  return createAppAuthClient(browserAuthBaseURL());
}
