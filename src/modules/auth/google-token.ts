/**
 * Google OAuth token 交换 & userinfo
 *
 * 授权码模式:
 *   1. 前端拿 code 给我们
 *   2. 我们用 code + client_id + client_secret 调 https://oauth2.googleapis.com/token
 *   3. Google 返回 access_token (+ refresh_token + id_token)
 *   4. 我们用 access_token 调 https://www.googleapis.com/oauth2/v3/userinfo 拿用户信息
 *
 * 不验 ID token 签名(我们信任 HTTPS 通道 + 用了 client_secret 校验);
 *  userinfo 端点是 Google 验证过的真实数据,等价于已验证身份。
 */

import env from '../../env.js';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: 'Bearer';
  id_token?: string;
}

export interface GoogleUserInfo {
  sub: string;          // Google 稳定用户 id
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

/**
 * 用授权码换 token
 * @throws 当 Google 返回非 2xx 时抛 Error
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<GoogleTokenResponse> {
  const params = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google token exchange failed (${res.status}): ${text}`);
  }

  return await res.json() as GoogleTokenResponse;
}

/**
 * 用 access_token 拿用户信息
 */
export async function fetchUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google userinfo failed (${res.status}): ${text}`);
  }

  return await res.json() as GoogleUserInfo;
}

/**
 * 校验 redirect_uri 是否在我们允许的范围内
 * (防止有人拿任意 redirect_uri 来骗后端换 token)
 */
export function isAllowedRedirect(uri: string): boolean {
  try {
    const re = new RegExp(env.GOOGLE_ALLOWED_REDIRECT_REGEX);
    return re.test(uri);
  } catch {
    return false;
  }
}
