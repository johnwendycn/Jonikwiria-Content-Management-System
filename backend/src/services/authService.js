const crypto = require('crypto');
const User = require('../models/user');
const UserStatusType = require('../models/userStatusType');
const Role = require('../models/role');
const UserRole = require('../models/userRole');
const Session = require('../models/session');
const PasswordReset = require('../models/passwordReset');
const EmailVerification = require('../models/emailVerification');
const LoginAttempt = require('../models/loginAttempt');

class AuthService {
  /**
   * Helper: Hash password using PBKDF2
   */
  hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  }

  /**
   * Helper: Generate unique sha256 hash for raw tokens
   */
  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * User registration (Signup)
   */
  async signup({ email, password, display_name, first_name, last_name, ip_address }) {
    if (!email || !password) {
      throw new Error('Email and password are required.');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      throw new Error('Email address is already registered.');
    }

    // Get "Pending Verification" status type or default to the first inactive status
    let pendingStatus = await UserStatusType.findOne({ where: { slug: 'pending-verification' } });
    if (!pendingStatus) {
      // Fallback
      pendingStatus = await UserStatusType.findOne({ where: { is_active_state: false } });
    }
    if (!pendingStatus) {
      throw new Error('No appropriate inactive status state found to assign user on registration.');
    }

    // Hash password
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = this.hashPassword(password, salt);

    // Create user record
    const user = await User.create({
      email,
      password_hash: passwordHash,
      salt,
      display_name: display_name || `${first_name || ''} ${last_name || ''}`.trim() || email.split('@')[0],
      first_name,
      last_name,
      status_id: pendingStatus.id,
      failed_login_attempts: 0,
      security_clearance: 10
    });

    // Auto-assign default subscriber role if exists
    const defaultRole = await Role.findOne({ where: { slug: 'general-member' } });
    if (defaultRole) {
      await UserRole.create({
        user_id: user.id,
        role_id: defaultRole.id,
        is_active: true,
        reason: 'Auto-assigned default general subscriber role on registration.'
      });
    }

    // Generate Email Verification Token
    const plainToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(plainToken);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Valid for 24 hours

    await EmailVerification.create({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name
      },
      emailVerificationToken: plainToken // Return plain token for testing/verification
    };
  }

  /**
   * User authentication (Login)
   */
  async login({ email, password, ip_address, user_agent }) {
    if (!email || !password) {
      throw new Error('Email and password are required.');
    }

    const clientIp = ip_address || '127.0.0.1';
    
    // Create pre-audit record of attempt
    const attempt = await LoginAttempt.create({
      email,
      ip_address: clientIp,
      was_successful: false
    });

    const user = await User.findOne({ 
      where: { email },
      include: [
        { model: UserStatusType, as: 'statusType' }
      ]
    });

    if (!user) {
      throw new Error('Invalid email or password credentials.');
    }

    // Check locking bounds
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      throw new Error(`This account is locked due to too many failed login attempts. Try again in ${minutesLeft} minutes.`);
    }

    // Validate if status allows logins
    if (user.statusType && !user.statusType.allows_login) {
      throw new Error(`Login blocked. Account status: ${user.statusType.name}. Reason: ${user.status_reason || 'Administrative restriction.'}`);
    }

    // Validate password
    const incomingHash = this.hashPassword(password, user.salt);
    if (incomingHash !== user.password_hash) {
      // Record failure metrics
      const attemptsCount = user.failed_login_attempts + 1;
      const updates = {
        failed_login_attempts: attemptsCount,
        last_failed_login_at: new Date()
      };

      if (attemptsCount >= 5) {
        const lockTime = new Date();
        lockTime.setMinutes(lockTime.getMinutes() + 15); // Lock for 15 minutes
        updates.locked_until = lockTime;
        updates.status_reason = 'Automatically locked due to 5 consecutive login failures.';
      }

      await user.update(updates);
      throw new Error('Invalid email or password credentials.');
    }

    // Success! Update audit fields
    await user.update({
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: new Date(),
      last_login_ip: clientIp
    });

    await attempt.update({ was_successful: true });

    // Generate Session Token
    const plainSessionToken = crypto.randomBytes(40).toString('hex');
    const sessionTokenHash = this.hashToken(plainSessionToken);
    
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7); // Active for 7 days

    const session = await Session.create({
      user_id: user.id,
      token_hash: sessionTokenHash,
      ip_address: clientIp,
      user_agent,
      expires_at: expiry
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        security_clearance: user.security_clearance
      },
      sessionToken: plainSessionToken,
      expiresAt: expiry
    };
  }

  /**
   * Session revocation (Logout)
   */
  async logout(sessionToken) {
    if (!sessionToken) return;
    const sessionTokenHash = this.hashToken(sessionToken);
    const session = await Session.findOne({ where: { token_hash: sessionTokenHash, is_revoked: false } });
    if (session) {
      await session.update({ is_revoked: true });
    }
  }

  /**
   * Password Reset Request (Forgot Password)
   */
  async forgotPassword(email) {
    if (!email) {
      throw new Error('Email address is required.');
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new Error('Email address not registered in the system.');
    }

    // Generate reset token
    const plainToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(plainToken);
    
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Valid for 1 hour

    await PasswordReset.create({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt
    });

    return {
      email: user.email,
      resetToken: plainToken // Return plain token to bypass actual email routing for direct execution
    };
  }

  /**
   * Password Reset execution
   */
  async resetPassword({ token, newPassword }) {
    if (!token || !newPassword) {
      throw new Error('Reset token and new password are required.');
    }

    const tokenHash = this.hashToken(token);
    const resetRecord = await PasswordReset.findOne({
      where: {
        token_hash: tokenHash,
        used_at: null
      }
    });

    if (!resetRecord) {
      throw new Error('Password reset token is invalid or has already been used.');
    }

    if (new Date() > new Date(resetRecord.expires_at)) {
      throw new Error('Password reset token has expired.');
    }

    const user = await User.findByPk(resetRecord.user_id);
    if (!user) {
      throw new Error('User associated with this reset token does not exist.');
    }

    // Hash and update password
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = this.hashPassword(newPassword, salt);

    await user.update({
      password_hash: passwordHash,
      salt,
      locked_until: null,
      failed_login_attempts: 0,
      last_password_change: new Date()
    });

    // Mark reset record as used
    await resetRecord.update({ used_at: new Date() });

    // Revoke all existing sessions for safety
    await Session.update(
      { is_revoked: true },
      { where: { user_id: user.id, is_revoked: false } }
    );

    return { success: true, message: 'Password updated successfully.' };
  }

  /**
   * Validate session token (Auth Gate middleware helper)
   */
  async validateSession(sessionToken) {
    if (!sessionToken) {
      throw new Error('Session token is missing.');
    }

    const sessionTokenHash = this.hashToken(sessionToken);
    const session = await Session.findOne({
      where: {
        token_hash: sessionTokenHash,
        is_revoked: false
      },
      include: [
        { 
          model: User, 
          as: 'user',
          include: [{ model: UserStatusType, as: 'statusType' }]
        }
      ]
    });

    if (!session) {
      throw new Error('Session not found or has been revoked.');
    }

    if (new Date() > new Date(session.expires_at)) {
      await session.update({ is_revoked: true });
      throw new Error('Session has expired.');
    }

    // Refresh last activity time
    await session.update({ last_activity: new Date() });

    return session.user;
  }
}

module.exports = new AuthService();
