const auditLogService = require('../services/auditLogService');

class AuditLogController {
  async getAll(req, res) {
    try {
      const {
        page, limit, event_type, severity, actor_id, actor_email,
        resource_type, action, success, date_from, date_to, search,
        sortBy, sortOrder
      } = req.query;

      const data = await auditLogService.getAll({
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 25,
        event_type,
        severity,
        actor_id,
        actor_email,
        resource_type,
        action,
        success,
        date_from,
        date_to,
        search,
        sortBy,
        sortOrder
      });

      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('Error in getAll controller (AuditLog):', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const log = await auditLogService.getById(id);
      return res.status(200).json({ success: true, data: log });
    } catch (error) {
      console.error(`Error in getById controller (AuditLog) for ID ${req.params.id}:`, error);
      const status = error.message.includes('not found') ? 404 : 500;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async getStats(req, res) {
    try {
      const { date_from, date_to } = req.query;
      const stats = await auditLogService.getStats({ date_from, date_to });
      return res.status(200).json({ success: true, data: stats });
    } catch (error) {
      console.error('Error in getStats controller (AuditLog):', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Block all mutation attempts at the controller level
  async blockMutation(req, res) {
    return res.status(405).json({
      success: false,
      message: 'METHOD NOT ALLOWED: Audit log entries are immutable. Create, update, and delete operations are permanently disabled for security compliance.'
    });
  }
}

module.exports = new AuditLogController();
