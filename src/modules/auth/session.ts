/**
 * Session token 工具
 *
 * - generateSessionToken(): 随机 32 字节 base64url
 * - hashEmail(email): sha256 hex,取前 32 字符作为 user.id
 */

import { createHash, randomBytes } from 'node:crypto';

/** 随机 32 字节,base64url 编码 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** 由 email 派生的确定性 user.id(32 字符 hex) */
export function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex').slice(0, 32);
}

/** 30 天过期 */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export function expiresAtFromNow(): Date {
  return new Date(Date.now() + SESSION_TTL_MS);
}
