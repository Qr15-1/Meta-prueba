import 'dotenv/config';
import { createHmac } from 'crypto';

const secret = process.env.PORTAL_SESSION_SECRET || '';

if (!secret) {
  throw new Error('PORTAL_SESSION_SECRET no está configurada en .env');
}

type SessionPayload = {
  id: number;
  marcaId: number;
  email: string;
  exp: number;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf-8');
}

function sign(value: string) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function createSessionToken(payload: Omit<SessionPayload, 'exp'>, ttlSeconds = 60 * 60 * 8) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const data = { ...payload, exp };
  const encoded = base64UrlEncode(JSON.stringify(data));
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token?: string | null): SessionPayload | null {
  if (!token) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  if (sign(encoded) !== signature) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as SessionPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
