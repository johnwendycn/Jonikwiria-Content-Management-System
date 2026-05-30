const { Op } = require('sequelize');
const UserPermission = require('../models/userPermission');
const User = require('../models/user');
const Permission = require('../models/permission');
const { isPostgres } = require('../config/database');

class UserPermissionService {
  /**
   * Get all user permission mappings with pagination, filtering and sorting
   */
  async getAll({ page = 1, limit = 10, search = '', sortBy = 'created_at', sortOrder = 'DESC' }) {
    const offset = (page - 1) * limit;
    const whereClause = {};

    if (search && search.trim() !== '') {
      const searchOperator = isPostgres ? Op.iLike : Op.like;
      const searchVal = `%${search.trim()}%`;
      whereClause[Op.or] = [
        { reason: { [searchOperator]: searchVal } },
        { '$user.email$': { [searchOperator]: searchVal } },
        { '$user.display_name$': { [searchOperator]: searchVal } },
        { '$permission.name$': { [searchOperator]: searchVal } }
      ];
    }

    let orderArray = [['created_at', 'DESC']];
    const allowedSortFields = ['valid_from', 'valid_until', 'is_allowed', 'created_at', 'updated_at'];
    const orderDir = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    if (allowedSortFields.includes(sortBy)) {
      orderArray = [[sortBy, orderDir]];
    } else if (sortBy === 'user_email') {
      orderArray = [[{ model: User, as: 'user' }, 'email', orderDir]];
    } else if (sortBy === 'permission_name') {
      orderArray = [[{ model: Permission, as: 'permission' }, 'name', orderDir]];
    }

    const { count, rows } = await UserPermission.findAndCountAll({
      where: whereClause,
      include: [
        { model: User, as: 'user', attributes: ['id', 'email', 'display_name'] },
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
      userPermissions: rows,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page)
    };
  }

  /**
   * Get a single mapping by ID
   */
  async getById(id) {
    const userPermission = await UserPermission.findByPk(id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'email', 'display_name'] },
        { model: Permission, as: 'permission', attributes: ['id', 'name', 'description'] },
        { model: User, as: 'granter', attributes: ['id', 'email', 'display_name'] }
      ]
    });
    if (!userPermission) {
      throw new Error(`User permission assignment with ID ${id} not found.`);
    }
    return userPermission;
  }

  /**
   * Create a new user permission mapping
   */
  async create(data) {
    // 1. Verify user exists
    if (!data.user_id) {
      throw new Error('user_id is required.');
    }
    const user = await User.findByPk(data.user_id);
    if (!user) {
      throw new Error(`User with ID ${data.user_id} does not exist.`);
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

    // 6. Uniqueness validation for active mappings (valid_until IS NULL)
    const hasExpiry = !!data.valid_until;
    if (!hasExpiry) {
      const existingActive = await UserPermission.findOne({
        where: {
          user_id: data.user_id,
          permission_id: data.permission_id,
          valid_until: null
        }
      });
      if (existingActive) {
        throw new Error('This permission is already actively assigned to this user without an expiration date.');
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

    const created = await UserPermission.create(data);
    return await this.getById(created.id);
  }

  /**
   * Update a user permission mapping
   */
  async update(id, data) {
    const userPermission = await this.getById(id);

    // Validate relationships
    if (data.user_id && data.user_id !== userPermission.user_id) {
      const user = await User.findByPk(data.user_id);
      if (!user) {
        throw new Error(`User with ID ${data.user_id} does not exist.`);
      }
    }
    if (data.permission_id && data.permission_id !== userPermission.permission_id) {
      const permission = await Permission.findByPk(data.permission_id);
      if (!permission) {
        throw new Error(`Permission with ID ${data.permission_id} does not exist.`);
      }
    }
    if (data.granted_by && data.granted_by !== userPermission.granted_by) {
      const granter = await User.findByPk(data.granted_by);
      if (!granter) {
        throw new Error(`Granting Auditor with ID ${data.granted_by} does not exist.`);
      }
    }

    // Date validation
    const fromDate = data.valid_from ? new Date(data.valid_from) : new Date(userPermission.valid_from);
    const untilDate = data.hasOwnProperty('valid_until') ? (data.valid_until ? new Date(data.valid_until) : null) : (userPermission.valid_until ? new Date(userPermission.valid_until) : null);
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
    const finalConditions = data.hasOwnProperty('conditions') ? data.conditions : userPermission.conditions;
    if (finalConditions && (typeof finalConditions !== 'object' || Array.isArray(finalConditions))) {
      throw new Error('Conditions must be a JSON object.');
    }

    // Uniqueness validation
    const checkUserId = data.user_id || userPermission.user_id;
    const checkPermissionId = data.permission_id || userPermission.permission_id;

    if (!untilDate) {
      const existingActive = await UserPermission.findOne({
        where: {
          user_id: checkUserId,
          permission_id: checkPermissionId,
          valid_until: null,
          id: { [Op.ne]: id }
        }
      });
      if (existingActive) {
        throw new Error('This permission is already actively assigned to this user without an expiration date.');
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

    await userPermission.update(data);
    return await this.getById(id);
  }

  /**
   * Delete a mapping
   */
  async delete(id) {
    const userPermission = await this.getById(id);
    await userPermission.destroy();
    return { id, message: 'User permission mapping deleted successfully.' };
  }

  /**
   * Bulk delete mappings
   */
  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('No IDs provided for bulk deletion.');
    }

    const deletedCount = await UserPermission.destroy({
      where: {
        id: ids
      }
    });

    return {
      deletedCount,
      message: `Successfully deleted ${deletedCount} user permission assignments.`
    };
  }
}

module.exports = new UserPermissionService();
