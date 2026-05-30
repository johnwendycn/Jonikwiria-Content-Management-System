const auditService = require('../services/auditService');
const { AuditService } = require('../services/auditService');

// Paths to skip (health checks, static assets)
const SKIP_PATHS = ['/api/health', '/favicon.ico'];

/**
 * Express Audit Middleware
 *
 * Automatically captures every API request/response and writes a structured
 * audit log entry. Runs after CORS + JSON parsing, before route handlers.
 *
 * Actor resolution: reads Bearer token from Authorization header and
 * resolves the user context asynchronously after the response is sent
 * (fire-and-forget) to avoid blocking request processing.
 */
function auditMiddleware(req, res, next) {
  const startTime = Date.now();

  // Skip non-auditable paths
  const path = req.path || req.url || '';
  if (SKIP_PATHS.some(skip => path.startsWith(skip))) {
    return next();
  }

  // Capture request body snapshot (sanitized — remove passwords)
  const sanitizeBody = (body) => {
    if (!body || typeof body !== 'object') return null;
    const safe = { ...body };
    const sensitiveFields = ['password', 'password_hash', 'token', 'token_hash', 'salt', 'mfa_secret', 'newPassword'];
    sensitiveFields.forEach(field => {
      if (safe[field] !== undefined) safe[field] = '[REDACTED]';
    });
    return safe;
  };

  const requestBodySnapshot = sanitizeBody(req.body);

  // Intercept res.json to capture response status and body
  const originalJson = res.json.bind(res);
  let responseBodySnapshot = null;
  let responseCaptured = false;

  res.json = function (body) {
    if (!responseCaptured) {
      responseBodySnapshot = body;
      responseCaptured = true;
    }
    return originalJson(body);
  };

  // After response is sent, fire audit log (non-blocking)
  res.on('finish', async () => {
    try {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      const method = req.method;
      const fullPath = req.originalUrl || req.url || path;
      const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || null;

      // Skip audit for audit-log reads to prevent log spam
      if (fullPath.includes('/api/audit-logs')) return;

      // Resolve actor from session token
      const authHeader = req.headers.authorization;
      const sessionToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

      let actorContext = null;
      if (sessionToken) {
        actorContext = await auditService.resolveActorFromToken(sessionToken);
      }

      const action = AuditService.resolveAction(method, fullPath);
      const severity = AuditService.resolveSeverity(statusCode, method);
      const eventType = AuditService.resolveEventType(fullPath);
      const success = statusCode < 400;

      // Extract resource_id from path params if present
      const pathSegments = fullPath.replace('/api/', '').split('/').filter(Boolean);
      const possibleId = pathSegments[1];
      const isUuid = possibleId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(possibleId);

      await auditService.log({
        event_type: eventType,
        action,
        severity,
        actor_id: actorContext?.actor_id || null,
        actor_email: actorContext?.actor_email || null,
        actor_display_name: actorContext?.actor_display_name || null,
        actor_ip: clientIp,
        actor_user_agent: userAgent,
        actor_session_id: actorContext?.actor_session_id || null,
        resource_type: pathSegments[0]?.replace(/-/g, '_') || null,
        resource_id: isUuid ? possibleId : null,
        http_method: method,
        http_path: fullPath,
        http_status: statusCode,
        duration_ms: duration,
        changes_before: null, // Populated by explicit model hooks or service calls
        changes_after: requestBodySnapshot,
        metadata: {
          request_body_keys: requestBodySnapshot ? Object.keys(requestBodySnapshot) : null,
          response_success: responseBodySnapshot?.success,
          response_message: responseBodySnapshot?.message || null
        },
        error_message: !success ? (responseBodySnapshot?.message || `HTTP ${statusCode}`) : null,
        success
      });
    } catch (err) {
      console.error('[AUDIT MIDDLEWARE ERROR]', err.message);
    }
  });

  next();
}

module.exports = auditMiddleware;
