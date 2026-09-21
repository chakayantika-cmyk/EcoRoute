// ============================================================================
// JWT Token Management
// ============================================================================

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getConfig } from '../config/env';

export interface AccessTokenPayload {
  userId: string;
  email: string;
  role: string;
}

export function generateAccessToken(payload: AccessTokenPayload): string {
  const config = getConfig();
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRES_IN as any,
    issuer: 'ecoroute-ai',
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const config = getConfig();
  return jwt.verify(token, config.JWT_ACCESS_SECRET, {
    issuer: 'ecoroute-ai',
  }) as AccessTokenPayload;
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) return 900000; // 15 minutes default

  const value = parseInt(match[1]!, 10);
  const unit = match[2];
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 3600 * 1000;
    case 'd': return value * 86400 * 1000;
    default: return 900000;
  }
}
