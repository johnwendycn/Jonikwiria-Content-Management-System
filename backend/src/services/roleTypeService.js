const { Op } = require('sequelize');
const RoleType = require('../models/roleType');
const { isPostgres } = require('../config/database');

class RoleTypeService {
  /**
   * Get all role types with pagination, filtering and sorting
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
      'is_system_role', 'is_assignable', 'is_hierarchical', 
      'allows_custom_permissions', 'auto_assign_on_register'
    ];
    const orderField = allowedSortFields.includes(sortBy) ? sortBy : 'sort_order';
    const orderDir = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'ASC';

    const { count, rows } = await RoleType.findAndCountAll({
      where: whereClause,
      order: [[orderField, orderDir]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return {
      totalItems: count,
      roleTypes: rows,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page)
    };
  }

  /**
   * Get a single role type by ID
   */
  async getById(id) {
    const roleType = await RoleType.findByPk(id);
    if (!roleType) {
      throw new Error(`Role type with ID ${id} not found.`);
    }
    return roleType;
  }

  /**
   * Create a new role type
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
      const existingName = await RoleType.findOne({ where: { name: data.name } });
      if (existingName) {
        throw new Error(`A role type with the name '${data.name}' already exists.`);
      }
    }

    if (data.slug) {
      const existingSlug = await RoleType.findOne({ where: { slug: data.slug } });
      if (existingSlug) {
        throw new Error(`A role type with the slug '${data.slug}' already exists.`);
      }
    }

    return await RoleType.create(data);
  }

  /**
   * Update a role type
   */
  async update(id, data) {
    const roleType = await this.getById(id);

    // Safeguard system roles from slug/name/system modifications
    if (roleType.is_system_role) {
      if (data.name && data.name !== roleType.name) {
        throw new Error('Cannot rename a system-defined role type.');
      }
      if (data.slug && data.slug !== roleType.slug) {
        throw new Error('Cannot change the slug of a system-defined role type.');
      }
      if (data.is_system_role === false) {
        throw new Error('Cannot change system role designation.');
      }
    }

    // Update slug if name changes and slug not explicitly updated
    if (data.name && !data.slug && data.name !== roleType.name) {
      data.slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    // Check unique constraints for name and slug if updated
    if (data.name && data.name !== roleType.name) {
      const existingName = await RoleType.findOne({ where: { name: data.name } });
      if (existingName) {
        throw new Error(`A role type with the name '${data.name}' already exists.`);
      }
    }

    if (data.slug && data.slug !== roleType.slug) {
      const existingSlug = await RoleType.findOne({ where: { slug: data.slug } });
      if (existingSlug) {
        throw new Error(`A role type with the slug '${data.slug}' already exists.`);
      }
    }

    await roleType.update(data);
    return roleType;
  }

  /**
   * Delete a role type
   */
  async delete(id) {
    const roleType = await this.getById(id);
    
    if (roleType.is_system_role) {
      throw new Error('System-defined role types cannot be deleted.');
    }

    await roleType.destroy();
    return { id, message: 'Role type deleted successfully.' };
  }

  /**
   * Bulk delete role types
   */
  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('No IDs provided for bulk deletion.');
    }

    // Find if any of them are system roles
    const systemRoleTypes = await RoleType.findAll({
      where: {
        id: ids,
        is_system_role: true
      }
    });

    if (systemRoleTypes.length > 0) {
      const systemNames = systemRoleTypes.map(s => s.name).join(', ');
      throw new Error(`Cannot delete system-defined role types: [ ${systemNames} ]. Operations aborted.`);
    }

    const deletedCount = await RoleType.destroy({
      where: {
        id: ids
      }
    });

    return {
      deletedCount,
      message: `Successfully deleted ${deletedCount} role types.`
    };
  }
}

module.exports = new RoleTypeService();
