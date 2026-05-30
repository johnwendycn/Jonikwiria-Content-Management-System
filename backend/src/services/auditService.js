const AuditLog = require('../models/auditLog');
const crypto = require('crypto');
const Session = require('../models/session');
const User = require('../models/user');

/**
 * AuditService — Centralized, immutable event logging service.
 *
 * This service is append-only. No audit record can be modified after creation.
 * All methods use AuditLog.create() exclusively.
 */
class AuditService {

  /**
   * Core log method. All other helpers delegate here.
   * @param {Object} payload
   */
  async log(payload) {
    try {
      const entry = {
        event_type: payload.event_type || 'SYSTEM',
        action: payload.action || 'system.event',
        severity: payload.severity || 'INFO',
        actor_id: payload.actor_id || null,
        actor_email: payload.actor_email || null,
        actor_display_name: payload.actor_display_name || null,
        actor_ip: payload.actor_ip || null,
        actor_user_agent: payload.actor_user_agent || null,
        actor_session_id: payload.actor_session_id || null,
        resource_type: payload.resource_type || null,
        resource_id: payload.resource_id ? String(payload.resource_id) : null,
        resource_name: payload.resource_name || null,
        http_method: payload.http_method || null,
        http_path: payload.http_path || null,
        http_status: payload.http_status || null,
        duration_ms: payload.duration_ms || null,
        changes_before: payload.changes_before || null,
        changes_after: payload.changes_after || null,
        metadata: payload.metadata || null,
        error_message: payload.error_message || null,
        success: payload.success !== undefined ? payload.success : true,
        created_at: new Date()
      };

      // Use raw SQL insert via sequelize to bypass any accidental hook issues
      await AuditLog.create(entry);
    } catch (err) {
      // Audit failures must NEVER crash the application — log to stderr only
      console.error('[AUDIT SERVICE ERROR] Failed to write audit log entry:', err.message);
    }
  }

  /**
   * Resolve actor context from a session token
   */
  async resolveActorFromToken(sessionToken) {
    if (!sessionToken) return null;
    try {
      const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
      const session = await Session.findOne({
        where: { token_hash: tokenHash, is_revoked: false },
        include: [{ model: User, as: 'user' }]
      });
      if (!session || !session.user) return null;
      return {
        actor_id: session.user.id,
        actor_email: session.user.email,
        actor_display_name: session.user.display_name,
        actor_session_id: session.id
      };
    } catch (err) {
      return null;
    }
  }

  /**
   * Shorthand: Authentication events (login, logout, signup, password reset)
   */
  async logAuth({ action, severity = 'INFO', actor, ip, user_agent, resource_id, resource_name, metadata, success = true, error_message }) {
    return this.log({
      event_type: 'AUTH',
      action,
      severity,
      actor_id: actor?.id || actor?.actor_id,
      actor_email: actor?.email || actor?.actor_email,
      actor_display_name: actor?.display_name || actor?.actor_display_name,
      actor_ip: ip,
      actor_user_agent: user_agent,
      resource_type: 'sessions',
      resource_id,
      resource_name,
      metadata,
      success,
      error_message
    });
  }

  /**
   * Shorthand: Data mutation events (create, update, delete on any entity)
   */
  async logData({ action, event_type = 'DATA', severity = 'INFO', actor, ip, resource_type, resource_id, resource_name, changes_before, changes_after, metadata, success = true, error_message }) {
    return this.log({
      event_type,
      action,
      severity,
      actor_id: actor?.id || actor?.actor_id,
      actor_email: actor?.email || actor?.actor_email,
      actor_display_name: actor?.display_name || actor?.actor_display_name,
      actor_ip: ip,
      resource_type,
      resource_id,
      resource_name,
      changes_before,
      changes_after,
      metadata,
      success,
      error_message
    });
  }

  /**
   * Shorthand: System events (startup, sync, errors)
   */
  async logSystem({ action, severity = 'INFO', metadata, error_message, success = true }) {
    return this.log({
      event_type: 'SYSTEM',
      action,
      severity,
      metadata,
      error_message,
      success
    });
  }

  /**
   * Map HTTP method + path to semantic action label
   */
  static resolveAction(method, path) {
    const m = (method || '').toUpperCase();
    const p = (path || '').toLowerCase();

    // Auth routes
    if (p.includes('/auth/login')) return 'session.login';
    if (p.includes('/auth/logout')) return 'session.logout';
    if (p.includes('/auth/signup')) return 'user.register';
    if (p.includes('/auth/forgot-password')) return 'auth.forgot_password';
    if (p.includes('/auth/reset-password')) return 'auth.reset_password';
    if (p.includes('/auth/session')) return 'session.verify';

    // Determine resource from path segment
    const segments = p.replace('/api/', '').split('/').filter(Boolean);
    const resource = segments[0]?.replace(/-/g, '_') || 'resource';
    const hasId = segments.length > 1 && !['bulk-delete', 'restore', 'stats'].includes(segments[1]);
    const subAction = segments[1];

    if (subAction === 'bulk-delete') return `${resource}.bulk_delete`;
    if (subAction === 'restore') return `${resource}.restore`;

    switch (m) {
      case 'GET': return hasId ? `${resource}.read` : `${resource}.list`;
      case 'POST': return `${resource}.create`;
      case 'PUT':
      case 'PATCH': return `${resource}.update`;
      case 'DELETE': return `${resource}.delete`;
      default: return `${resource}.request`;
    }
  }

  /**
   * Map HTTP status to severity
   */
  static resolveSeverity(statusCode, method) {
    if (statusCode >= 500) return 'ERROR';
    if (statusCode === 401 || statusCode === 403) return 'WARN';
    if (statusCode >= 400) return 'WARN';
    const m = (method || '').toUpperCase();
    if (m === 'DELETE') return 'WARN';
    if (m === 'PUT' || m === 'PATCH') return 'INFO';
    return 'INFO';
  }

  /**
   * Map path to event_type
   */
  static resolveEventType(path) {
    const p = (path || '').toLowerCase();
    if (p.includes('/auth/')) return 'AUTH';
    if (p.includes('/users')) return 'USER';
    if (p.includes('/roles') || p.includes('/role-types') || p.includes('/user-roles')) return 'ROLE';
    if (p.includes('/permissions') || p.includes('/role-permissions') || p.includes('/user-permissions')) return 'PERMISSION';
    if (p.includes('/access-control') || p.includes('/action-types') || p.includes('/resource-types')) return 'ACCESS_CONTROL';
    if (p.includes('/audit-logs')) return 'SYSTEM';
    return 'DATA';
  }
}

module.exports = new AuditService();
module.exports.AuditService = AuditService;
