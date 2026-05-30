const { Op } = require('sequelize');
const RolePermission = require('../models/rolePermission');
const Role = require('../models/role');
const Permission = require('../models/permission');
const User = require('../models/user');
const { isPostgres } = require('../config/database');

class RolePermissionService {
  /**
   * Get all role permission mappings with pagination, filtering and sorting
   */
  async getAll({ page = 1, limit = 10, search = '', sortBy = 'created_at', sortOrder = 'DESC' }) {
    const offset = (page - 1) * limit;
    const whereClause = {};

    if (search && search.trim() !== '') {
      const searchOperator = isPostgres ? Op.iLike : Op.like;
      const searchVal = `%${search.trim()}%`;
      whereClause[Op.or] = [
        { reason: { [searchOperator]: searchVal } },
        { '$role.name$': { [searchOperator]: searchVal } },
        { '$permission.name$': { [searchOperator]: searchVal } }
      ];
    }

    let orderArray = [['created_at', 'DESC']];
    const allowedSortFields = ['valid_from', 'valid_until', 'is_allowed', 'created_at', 'updated_at'];
    const orderDir = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    if (allowedSortFields.includes(sortBy)) {
      orderArray = [[sortBy, orderDir]];
    } else if (sortBy === 'role_name') {
      orderArray = [[{ model: Role, as: 'role' }, 'name', orderDir]];
    } else if (sortBy === 'permission_name') {
      orderArray = [[{ model: Permission, as: 'permission' }, 'name', orderDir]];
    }

    const { count, rows } = await RolePermission.findAndCountAll({
      where: whereClause,
      include: [
        { model: Role, as: 'role', attributes: ['id', 'name', 'slug', 'priority'] },
        { model: Permission, as: 'permission', attributes: ['id', 'name', 'description'] },
        { model: User, as: 'granter', attributes: ['id', 'email', 'display_name'] }
      ],
      order: orderArray,
      limit: parseInt(limit),
      offset: parseInt(offset),
      subQuery: false
    });

    return {
      totalItems: count,
      rolePermissions: rows,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page)
    };
  }

  /**
   * Get a single mapping by ID
   */
  async getById(id) {
    const rolePermission = await RolePermission.findByPk(id, {
      include: [
        { model: Role, as: 'role', attributes: ['id', 'name', 'slug', 'priority'] },
        { model: Permission, as: 'permission', attributes: ['id', 'name', 'description'] },
        { model: User, as: 'granter', attributes: ['id', 'email', 'display_name'] }
      ]
    });
    if (!rolePermission) {
      throw new Error(`Role permission assignment with ID ${id} not found.`);
    }
    return rolePermission;
  }

  /**
   * Create a new role permission mapping
   */
  async create(data) {
    // 1. Verify role exists
    if (!data.role_id) {
      throw new Error('role_id is required.');
    }
    const role = await Role.findByPk(data.role_id);
    if (!role) {
      throw new Error(`Role with ID ${data.role_id} does not exist.`);
    }

    // 2. Verify permission exists
    if (!data.permission_id) {
      throw new Error('permission_id is required.');
    }
    const permission = await Permission.findByPk(data.permission_id);
    if (!permission) {
      throw new Error(`Permission with ID ${data.permission_id} does not exist.`);
    }

    // 3. Verify granter exists if provided
    if (data.granted_by) {
      const granter = await User.findByPk(data.granted_by);
      if (!granter) {
        throw new Error(`Granting Auditor with ID ${data.granted_by} does not exist.`);
      }
    }

    // 4. Date validation
    const fromDate = data.valid_from ? new Date(data.valid_from) : new Date();
    if (data.valid_until) {
      const untilDate = new Date(data.valid_until);
      if (untilDate <= fromDate) {
        throw new Error('valid_until must be after valid_from.');
      }
    }

    // 5. Conditions validation (must be object)
    if (data.conditions && typeof data.conditions === 'string') {
      try {
        data.conditions = JSON.parse(data.conditions);
      } catch (e) {
        throw new Error('Invalid JSON format provided for conditions.');
      }
    }
    if (data.conditions && (typeof data.conditions !== 'object' || Array.isArray(data.conditions))) {
      throw new Error('Conditions must be a JSON object.');
    }

    // 6. Uniqueness validation for active allowed rules
    const isAllowed = data.is_allowed !== false;
    const hasExpiry = !!data.valid_until;
    if (isAllowed && !hasExpiry) {
      const existingActive = await RolePermission.findOne({
        where: {
          role_id: data.role_id,
          permission_id: data.permission_id,
          is_allowed: true,
          valid_until: null
        }
      });
      if (existingActive) {
        throw new Error('This permission is already actively allowed for this role without an expiration date.');
      }
    }

    // JSON Parse helper for metadata
    if (data.metadata && typeof data.metadata === 'string') {
      try {
        data.metadata = JSON.parse(data.metadata);
      } catch (e) {
        throw new Error('Invalid JSON format provided for metadata.');
      }
    }

    const created = await RolePermission.create(data);
    return await this.getById(created.id);
  }

  /**
   * Update a role permission mapping
   */
  async update(id, data) {
    const rolePermission = await this.getById(id);

    // Validate relationships
    if (data.role_id && data.role_id !== rolePermission.role_id) {
      const role = await Role.findByPk(data.role_id);
      if (!role) {
        throw new Error(`Role with ID ${data.role_id} does not exist.`);
      }
    }
    if (data.permission_id && data.permission_id !== rolePermission.permission_id) {
      const permission = await Permission.findByPk(data.permission_id);
      if (!permission) {
        throw new Error(`Permission with ID ${data.permission_id} does not exist.`);
      }
    }
    if (data.granted_by && data.granted_by !== rolePermission.granted_by) {
      const granter = await User.findByPk(data.granted_by);
      if (!granter) {
        throw new Error(`Granting Auditor with ID ${data.granted_by} does not exist.`);
      }
    }

    // Date validation
    const fromDate = data.valid_from ? new Date(data.valid_from) : new Date(rolePermission.valid_from);
    const untilDate = data.hasOwnProperty('valid_until') ? (data.valid_until ? new Date(data.valid_until) : null) : (rolePermission.valid_until ? new Date(rolePermission.valid_until) : null);
    if (untilDate && untilDate <= fromDate) {
      throw new Error('valid_until must be after valid_from.');
    }

    // Conditions validation
    if (data.hasOwnProperty('conditions') && data.conditions && typeof data.conditions === 'string') {
      try {
        data.conditions = JSON.parse(data.conditions);
      } catch (e) {
        throw new Error('Invalid JSON format provided for conditions.');
      }
    }
    const finalConditions = data.hasOwnProperty('conditions') ? data.conditions : rolePermission.conditions;
    if (finalConditions && (typeof finalConditions !== 'object' || Array.isArray(finalConditions))) {
      throw new Error('Conditions must be a JSON object.');
    }

    // Uniqueness validation
    const checkAllowed = data.hasOwnProperty('is_allowed') ? data.is_allowed : rolePermission.is_allowed;
    const checkRoleId = data.role_id || rolePermission.role_id;
    const checkPermissionId = data.permission_id || rolePermission.permission_id;

    if (checkAllowed !== false && !untilDate) {
      const existingActive = await RolePermission.findOne({
        where: {
          role_id: checkRoleId,
          permission_id: checkPermissionId,
          is_allowed: true,
          valid_until: null,
          id: { [Op.ne]: id }
        }
      });
      if (existingActive) {
        throw new Error('This permission is already actively allowed for this role without an expiration date.');
      }
    }

    // JSON Parse helper for metadata
    if (data.hasOwnProperty('metadata') && data.metadata && typeof data.metadata === 'string') {
      try {
        data.metadata = JSON.parse(data.metadata);
      } catch (e) {
        throw new Error('Invalid JSON format provided for metadata.');
      }
    }

    await rolePermission.update(data);
    return await this.getById(id);
  }

  /**
   * Delete a mapping
   */
  async delete(id) {
    const rolePermission = await this.getById(id);
    await rolePermission.destroy();
    return { id, message: 'Role permission mapping deleted successfully.' };
  }

  /**
   * Bulk delete mappings
   */
  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('No IDs provided for bulk deletion.');
    }

    const deletedCount = await RolePermission.destroy({
      where: {
        id: ids
      }
    });

    return {
      deletedCount,
      message: `Successfully deleted ${deletedCount} role permission assignments.`
    };
  }
}

module.exports = new RolePermissionService();
