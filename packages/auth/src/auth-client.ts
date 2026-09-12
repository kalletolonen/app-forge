import { createAuthClient } from "better-auth/react";

export function createAppAuthClient(baseURL: string) {
  return createAuthClient({
    baseURL,
  });
}
