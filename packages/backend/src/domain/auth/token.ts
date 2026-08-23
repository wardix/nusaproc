import { config } from '../../config';
import { UnauthorizedError } from '../sod/errors';
import type { AppRole } from '@nusaproc/shared';

export interface AuthTokenPayload {
  userId: string;
  email: string;
  activeRole: AppRole;
  divisionId?: string;
  branchId?: string;
  exp?: number;
  iat?: number;
}

export interface ReauthTokenPayload {
  userId: string;
  action: string;
  purpose: 'STEP_UP_REAUTH';
  exp: number;
  iat: number;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

async function signHmac(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Buffer.from(signature)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function verifyHmac(data: string, signature: string, secret: string): Promise<boolean> {
  const expectedSig = await signHmac(data, secret);
  return expectedSig === signature;
}

/**
 * Generates standard session JWT token for authenticated users (Layer 1).
 */
export async function generateAuthToken(
  payload: Omit<AuthTokenPayload, 'exp' | 'iat'>,
  expiresInSeconds = 3600 * 8 // 8 hours
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: AuthTokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  const signature = await signHmac(dataToSign, config.jwtSecret);

  return `${dataToSign}.${signature}`;
}

/**
 * Verifies and decodes a session JWT token.
 */
export async function verifyAuthToken(token: string): Promise<AuthTokenPayload> {
  if (!token || typeof token !== 'string') {
    throw new UnauthorizedError('Token tidak ditemukan');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new UnauthorizedError('Format token tidak valid');
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const isValid = await verifyHmac(dataToSign, signature, config.jwtSecret);
  if (!isValid) {
    throw new UnauthorizedError('Signature token tidak valid atau telah dimanipulasi');
  }

  try {
    const payload: AuthTokenPayload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      throw new UnauthorizedError('Token telah kedaluwarsa');
    }

    return payload;
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError('Gagal memproses payload token');
  }
}

/**
 * Generates a short-lived, purpose-bound Step-Up Re-Authentication token (R5).
 */
export async function generateReauthToken(params: {
  userId: string;
  action: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const { userId, action, expiresInSeconds = 300 } = params; // Default 5 minutes
  const now = Math.floor(Date.now() / 1000);

  const payload: ReauthTokenPayload = {
    userId,
    action,
    purpose: 'STEP_UP_REAUTH',
    iat: now,
    exp: now + expiresInSeconds,
  };

  const header = { alg: 'HS256', typ: 'REAUTH' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  const signature = await signHmac(dataToSign, config.jwtSecret);

  return `${dataToSign}.${signature}`;
}

/**
 * Verifies a Step-Up Re-Authentication token and ensures it is bound to the target action (R5).
 */
export async function verifyReauthToken(
  token: string,
  expectedAction: string
): Promise<ReauthTokenPayload> {
  if (!token || typeof token !== 'string') {
    throw new UnauthorizedError('Reauth token tidak ditemukan');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new UnauthorizedError('Format reauth token tidak valid');
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const isValid = await verifyHmac(dataToSign, signature, config.jwtSecret);
  if (!isValid) {
    throw new UnauthorizedError('Signature reauth token tidak valid');
  }

  try {
    const payload: ReauthTokenPayload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    if (payload.purpose !== 'STEP_UP_REAUTH') {
      throw new UnauthorizedError('Token bukan merupakan token re-autentikasi yang valid');
    }

    if (payload.exp < now) {
      throw new UnauthorizedError('Reauth token telah kedaluwarsa');
    }

    if (payload.action !== expectedAction) {
      throw new UnauthorizedError(
        `Aksi token (${payload.action}) tidak sesuai dengan tindakan yang diminta (${expectedAction})`
      );
    }

    return payload;
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError('Gagal memvalidasi reauth token');
  }
}
