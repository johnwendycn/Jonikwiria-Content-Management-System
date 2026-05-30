const AuditLog = require('../models/auditLog');
const { Op } = require('sequelize');

class AuditLogService {
  async getAll({ page = 1, limit = 25, event_type, severity, actor_id, actor_email, resource_type, action, success, date_from, date_to, search, sortBy = 'created_at', sortOrder = 'DESC' }) {
    const offset = (page - 1) * limit;
    const where = {};

    if (event_type) where.event_type = event_type;
    if (severity) where.severity = severity;
    if (actor_id) where.actor_id = actor_id;
    if (resource_type) where.resource_type = resource_type;
    if (action) where.action = { [Op.like]: `%${action}%` };
    if (success !== undefined && success !== null && success !== '') {
      where.success = success === 'true' || success === true;
    }

    if (actor_email) {
      where.actor_email = { [Op.like]: `%${actor_email}%` };
    }

    if (date_from || date_to) {
      where.created_at = {};
      if (date_from) where.created_at[Op.gte] = new Date(date_from);
      if (date_to) {
        const to = new Date(date_to);
        to.setHours(23, 59, 59, 999);
        where.created_at[Op.lte] = to;
      }
    }

    if (search) {
      where[Op.or] = [
        { action: { [Op.like]: `%${search}%` } },
        { actor_email: { [Op.like]: `%${search}%` } },
        { actor_display_name: { [Op.like]: `%${search}%` } },
        { actor_ip: { [Op.like]: `%${search}%` } },
        { resource_type: { [Op.like]: `%${search}%` } },
        { resource_name: { [Op.like]: `%${search}%` } },
        { http_path: { [Op.like]: `%${search}%` } },
        { error_message: { [Op.like]: `%${search}%` } }
      ];
    }

    const allowedSortFields = ['created_at', 'action', 'severity', 'event_type', 'actor_email', 'http_status', 'duration_ms', 'resource_type'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = [[sortField, sortOrder === 'ASC' ? 'ASC' : 'DESC']];

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      order,
      limit: Math.min(limit, 100),
      offset
    });

    return {
      auditLogs: rows,
      totalItems: count,
      currentPage: page,
      totalPages: Math.ceil(count / limit),
      perPage: limit
    };
  }

  async getById(id) {
    const log = await AuditLog.findByPk(id);
    if (!log) throw new Error(`Audit log entry with ID "${id}" not found.`);
    return log;
  }

  async getStats({ date_from, date_to } = {}) {
    const where = {};
    if (date_from || date_to) {
      where.created_at = {};
      if (date_from) where.created_at[Op.gte] = new Date(date_from);
      if (date_to) {
        const to = new Date(date_to);
        to.setHours(23, 59, 59, 999);
        where.created_at[Op.lte] = to;
      }
    }

    const { sequelize } = require('../config/database');

    // Count by severity
    const bySeverity = await AuditLog.findAll({
      where,
      attributes: ['severity', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['severity'],
      raw: true
    });

    // Count by event_type
    const byEventType = await AuditLog.findAll({
      where,
      attributes: ['event_type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['event_type'],
      raw: true
    });

    // Count failures
    const failureCount = await AuditLog.count({ where: { ...where, success: false } });

    // Total entries
    const totalCount = await AuditLog.count({ where });

    // Recent critical events (last 10)
    const recentCritical = await AuditLog.findAll({
      where: { ...where, severity: 'CRITICAL' },
      order: [['created_at', 'DESC']],
      limit: 10
    });

    // Top 5 actors by event count
    const topActors = await AuditLog.findAll({
      where: { ...where, actor_email: { [Op.ne]: null } },
      attributes: ['actor_email', 'actor_display_name', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['actor_email', 'actor_display_name'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      limit: 5,
      raw: true
    });

    return {
      totalCount,
      failureCount,
      successCount: totalCount - failureCount,
      bySeverity: bySeverity.reduce((acc, r) => { acc[r.severity] = parseInt(r.count); return acc; }, {}),
      byEventType: byEventType.reduce((acc, r) => { acc[r.event_type] = parseInt(r.count); return acc; }, {}),
      recentCritical,
      topActors
    };
  }
}

module.exports = new AuditLogService();
