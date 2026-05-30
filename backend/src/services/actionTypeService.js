const { Op } = require('sequelize');
const ActionType = require('../models/actionType');
const { isPostgres } = require('../config/database');

class ActionTypeService {
  /**
   * Get all action types with pagination, filtering and sorting
   */
  async getAll({ page = 1, limit = 10, search = '', sortBy = 'sort_order', sortOrder = 'ASC' }) {
    const offset = (page - 1) * limit;
    const whereClause = {};

    if (search && search.trim() !== '') {
      const searchOperator = isPostgres ? Op.iLike : Op.like;
      const searchVal = `%${search.trim()}%`;
      whereClause[Op.or] = [
        { name: { [searchOperator]: searchVal } },
        { slug: { [searchOperator]: searchVal } },
        { description: { [searchOperator]: searchVal } },
        { verb: { [searchOperator]: searchVal } }
      ];
    }

    // Validate sorting parameters to avoid SQL injection
    const allowedSortFields = [
      'name', 'slug', 'verb', 'sort_order', 'created_at', 'updated_at', 
      'is_destructive', 'requires_owner_permission', 'log_level', 'is_system'
    ];
    const orderField = allowedSortFields.includes(sortBy) ? sortBy : 'sort_order';
    const orderDir = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'ASC';

    const { count, rows } = await ActionType.findAndCountAll({
      where: whereClause,
      order: [[orderField, orderDir]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return {
      totalItems: count,
      actionTypes: rows,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page)
    };
  }

  /**
   * Get a single action type by ID
   */
  async getById(id) {
    const actionType = await ActionType.findByPk(id);
    if (!actionType) {
      throw new Error(`Action type with ID ${id} not found.`);
    }
    return actionType;
  }

  /**
   * Create a new action type
   */
  async create(data) {
    // Generate slug from name if not provided
    if (!data.slug && data.name) {
      data.slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    // Check uniqueness manually
    if (data.name) {
      const existingName = await ActionType.findOne({ where: { name: data.name } });
      if (existingName) {
        throw new Error(`An action type with the name '${data.name}' already exists.`);
      }
    }

    if (data.slug) {
      const existingSlug = await ActionType.findOne({ where: { slug: data.slug } });
      if (existingSlug) {
        throw new Error(`An action type with the slug '${data.slug}' already exists.`);
      }
    }

    return await ActionType.create(data);
  }

  /**
   * Update an action type
   */
  async update(id, data) {
    const actionType = await this.getById(id);

    // Safeguard system actions from slug/name/system status overrides
    if (actionType.is_system) {
      if (data.name && data.name !== actionType.name) {
        throw new Error('Cannot rename a system-defined action type.');
      }
      if (data.slug && data.slug !== actionType.slug) {
        throw new Error('Cannot change the slug of a system-defined action type.');
      }
      if (data.is_system === false) {
        throw new Error('Cannot change system action designation.');
      }
    }

    // Update slug if name changes and slug not explicitly updated
    if (data.name && !data.slug && data.name !== actionType.name) {
      data.slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    // Check unique constraints
    if (data.name && data.name !== actionType.name) {
      const existingName = await ActionType.findOne({ where: { name: data.name } });
      if (existingName) {
        throw new Error(`An action type with the name '${data.name}' already exists.`);
      }
    }

    if (data.slug && data.slug !== actionType.slug) {
      const existingSlug = await ActionType.findOne({ where: { slug: data.slug } });
      if (existingSlug) {
        throw new Error(`An action type with the slug '${data.slug}' already exists.`);
      }
    }

    await actionType.update(data);
    return actionType;
  }

  /**
   * Delete an action type
   */
  async delete(id) {
    const actionType = await this.getById(id);
    
    if (actionType.is_system) {
      throw new Error('System-defined action types cannot be deleted.');
    }

    await actionType.destroy();
    return { id, message: 'Action type deleted successfully.' };
  }

  /**
   * Bulk delete action types
   */
  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('No IDs provided for bulk deletion.');
    }

    // Find if any of them are system actions
    const systemActionTypes = await ActionType.findAll({
      where: {
        id: ids,
        is_system: true
      }
    });

    if (systemActionTypes.length > 0) {
      const systemNames = systemActionTypes.map(s => s.name).join(', ');
      throw new Error(`Cannot delete system-defined action types: [ ${systemNames} ]. Operations aborted.`);
    }

    const deletedCount = await ActionType.destroy({
      where: {
        id: ids
      }
    });

    return {
      deletedCount,
      message: `Successfully deleted ${deletedCount} action types.`
    };
  }
}

module.exports = new ActionTypeService();
