/**
 * API key validation for AI agent access.
 *
 * Keys are stored in the API_KEYS environment variable (comma-separated).
 * Agents authenticate via the Authorization: Bearer <key> header.
 */

import { timingSafeEqual } from "crypto";

interface EnvGetter {
  get(key: string): string | undefined;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateApiKey(
  env: EnvGetter,
  authHeader: string | null,
): ValidationResult {
  if (!authHeader) {
    return { valid: false, error: "Missing Authorization header" };
  }

  const match = authHeader.match(/^Bearer\s+(\S+)$/);
  if (!match) {
    return {
      valid: false,
      error: "Invalid Authorization header format. Expected: Bearer <token>",
    };
  }

  const token = match[1];
  const keysRaw = env.get("API_KEYS");
  if (!keysRaw) {
    return { valid: false, error: "API keys not configured on server" };
  }

  const validKeys = keysRaw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  const tokenBuf = Buffer.from(token);
  const isValid = validKeys.some((key) => {
    const keyBuf = Buffer.from(key);
    if (tokenBuf.length !== keyBuf.length) return false;
    return timingSafeEqual(tokenBuf, keyBuf);
  });

  if (!isValid) {
    return { valid: false, error: "Invalid API key" };
  }

  return { valid: true };
}
