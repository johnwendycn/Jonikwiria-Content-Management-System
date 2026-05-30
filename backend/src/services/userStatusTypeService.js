const { Op } = require('sequelize');
const UserStatusType = require('../models/userStatusType');
const { isPostgres } = require('../config/database');

class UserStatusTypeService {
  /**
   * Get all user status types with pagination, filtering and sorting
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
        { description: { [searchOperator]: searchVal } }
      ];
    }

    // Validate sorting parameters to avoid SQL injection
    const allowedSortFields = [
      'name', 'slug', 'sort_order', 'created_at', 'updated_at', 
      'is_active_state', 'allows_login', 'allows_api_access', 
      'is_locked_state', 'is_terminal_state'
    ];
    const orderField = allowedSortFields.includes(sortBy) ? sortBy : 'sort_order';
    const orderDir = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'ASC';

    const { count, rows } = await UserStatusType.findAndCountAll({
      where: whereClause,
      order: [[orderField, orderDir]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return {
      totalItems: count,
      statusTypes: rows,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page)
    };
  }

  /**
   * Get a single user status type by ID
   */
  async getById(id) {
    const statusType = await UserStatusType.findByPk(id);
    if (!statusType) {
      throw new Error(`User status type with ID ${id} not found.`);
    }
    return statusType;
  }

  /**
   * Create a new user status type
   */
  async create(data) {
    // Generate slug from name if not provided
    if (!data.slug && data.name) {
      data.slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    // Check uniqueness of name and slug manually for nicer error messages
    if (data.name) {
      const existingName = await UserStatusType.findOne({ where: { name: data.name } });
      if (existingName) {
        throw new Error(`A user status type with the name '${data.name}' already exists.`);
      }
    }

    if (data.slug) {
      const existingSlug = await UserStatusType.findOne({ where: { slug: data.slug } });
      if (existingSlug) {
        throw new Error(`A user status type with the slug '${data.slug}' already exists.`);
      }
    }

    return await UserStatusType.create(data);
  }

  /**
   * Update a user status type
   */
  async update(id, data) {
    const statusType = await this.getById(id);

    // Safeguard system status types from slug/name/system modifications
    if (statusType.is_system) {
      if (data.name && data.name !== statusType.name) {
        throw new Error('Cannot rename a system-defined user status type.');
      }
      if (data.slug && data.slug !== statusType.slug) {
        throw new Error('Cannot change the slug of a system-defined user status type.');
      }
      if (data.is_system === false) {
        throw new Error('Cannot change system status designation.');
      }
    }

    // Update slug if name changes and slug not explicitly updated
    if (data.name && !data.slug && data.name !== statusType.name) {
      data.slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    // Check unique constraints for name and slug if updated
    if (data.name && data.name !== statusType.name) {
      const existingName = await UserStatusType.findOne({ where: { name: data.name } });
      if (existingName) {
        throw new Error(`A user status type with the name '${data.name}' already exists.`);
      }
    }

    if (data.slug && data.slug !== statusType.slug) {
      const existingSlug = await UserStatusType.findOne({ where: { slug: data.slug } });
      if (existingSlug) {
        throw new Error(`A user status type with the slug '${data.slug}' already exists.`);
      }
    }

    await statusType.update(data);
    return statusType;
  }

  /**
   * Delete a user status type
   */
  async delete(id) {
    const statusType = await this.getById(id);
    
    if (statusType.is_system) {
      throw new Error('System-defined user status types cannot be deleted.');
    }

    await statusType.destroy();
    return { id, message: 'User status type deleted successfully.' };
  }

  /**
   * Bulk delete user status types
   */
  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('No IDs provided for bulk deletion.');
    }

    // Find if any of them are system status types
    const systemStatusTypes = await UserStatusType.findAll({
      where: {
        id: ids,
        is_system: true
      }
    });

    if (systemStatusTypes.length > 0) {
      const systemNames = systemStatusTypes.map(s => s.name).join(', ');
      throw new Error(`Cannot delete system-defined user status types: [ ${systemNames} ]. Operations aborted.`);
    }

    const deletedCount = await UserStatusType.destroy({
      where: {
        id: ids
      }
    });

    return {
      deletedCount,
      message: `Successfully deleted ${deletedCount} user status types.`
    };
  }
}

module.exports = new UserStatusTypeService();
