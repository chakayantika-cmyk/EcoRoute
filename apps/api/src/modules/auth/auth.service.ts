// ============================================================================
// Auth Service — Business Logic
// ============================================================================

import { PrismaClient } from '@prisma/client';
import { hashPassword, verifyPassword } from '../../lib/password';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  generateResetToken,
  parseExpiresIn,
} from '../../lib/tokens';
import { getConfig } from '../../config/env';
import { sendOtpEmail } from '../../lib/email';
import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../lib/errors';

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  async requestOtp(email: string, _displayName: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.prisma.oTP.create({
      data: {
        email,
        code: otpCode,
        expiresAt,
      },
    });

    await sendOtpEmail(email, otpCode);
    return { message: 'OTP sent successfully' };
  }

  async register(email: string, otp: string, password: string, displayName: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }

    // Verify OTP
    const validOtp = await this.prisma.oTP.findFirst({
      where: {
        email,
        code: otp,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!validOtp) {
      throw new ValidationError('Invalid or expired OTP');
    }

    // Delete used OTP
    await this.prisma.oTP.deleteMany({ where: { email } });

    const passwordHash = await hashPassword(password);
    const user = await this.prisma.user.create({
      data: { email, passwordHash, displayName },
    });

    // Create default routing preferences
    await this.prisma.routingPreference.create({
      data: { userId: user.id },
    });

    // Audit log
    await this.createAuditEvent(user.id, 'user.registered', 'user', user.id);

    const tokens = await this.createSession(user.id, user.email, user.role);
    return {
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
      ...tokens,
    };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'ACTIVE') {
      throw new AuthenticationError('Invalid email or password');
    }

    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) {
      throw new AuthenticationError('Invalid email or password');
    }

    await this.createAuditEvent(user.id, 'user.logged_in', 'user', user.id);

    const tokens = await this.createSession(user.id, user.email, user.role);
    return {
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
      ...tokens,
    };
  }

  async logout(userId: string, refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    await this.prisma.session.updateMany({
      where: { userId, tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.createAuditEvent(userId, 'user.logged_out', 'user', userId);
  }

  async refresh(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    const session = await this.prisma.session.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    if (!session || session.user.status !== 'ACTIVE') {
      throw new AuthenticationError('Invalid or expired refresh token');
    }

    // Revoke old session (token rotation)
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    // Create new session
    return this.createSession(session.user.id, session.user.email, session.user.role);
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true, role: true, createdAt: true },
    });
    if (!user) throw new NotFoundError('User');
    return user;
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal if user exists. Return success regardless.
      return { message: 'If an account exists with this email, a reset link has been sent.' };
    }

    const resetToken = generateResetToken();
    const tokenHash = hashToken(resetToken);
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    // Store reset token as a session with a special marker
    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: `reset:${tokenHash}`,
        expiresAt,
      },
    });

    // In production, send email here.
    // In development, log the token.
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[DEV] Password reset token for ${email}: ${resetToken}`);
    }

    return { message: 'If an account exists with this email, a reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = hashToken(token);
    const session = await this.prisma.session.findFirst({
      where: {
        tokenHash: `reset:${tokenHash}`,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!session) {
      throw new ValidationError('Invalid or expired reset token');
    }

    const passwordHash = await hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: session.userId },
      data: { passwordHash },
    });

    // Revoke the reset token
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    // Revoke all other sessions (force re-login)
    await this.prisma.session.updateMany({
      where: { userId: session.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.createAuditEvent(session.userId, 'user.password_reset', 'user', session.userId);

    return { message: 'Password reset successfully. Please log in with your new password.' };
  }

  // ---- Private helpers ----

  private async createSession(userId: string, email: string, role: string) {
    const config = getConfig();
    const accessToken = generateAccessToken({ userId, email, role });
    const refreshToken = generateRefreshToken();
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + parseExpiresIn(config.JWT_REFRESH_EXPIRES_IN));

    await this.prisma.session.create({
      data: { userId, tokenHash, expiresAt },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: parseExpiresIn(config.JWT_ACCESS_EXPIRES_IN),
    };
  }

  private async createAuditEvent(
    userId: string,
    eventType: string,
    resourceType: string,
    resourceId: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.prisma.auditEvent.create({
      data: {
        userId,
        eventType,
        resourceType,
        resourceId,
        metadataJson: metadata ? JSON.stringify(metadata) : null,
      },
    });
  }
}
