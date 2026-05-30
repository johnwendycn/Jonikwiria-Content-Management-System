const { Op } = require('sequelize');
const UserRole = require('../models/userRole');
const User = require('../models/user');
const Role = require('../models/role');
const { isPostgres } = require('../config/database');

class UserRoleService {
  /**
   * Get all user role assignments with pagination, filtering and sorting
   */
  async getAll({ page = 1, limit = 10, search = '', sortBy = 'created_at', sortOrder = 'DESC' }) {
    const offset = (page - 1) * limit;
    const whereClause = {};

    if (search && search.trim() !== '') {
      const searchOperator = isPostgres ? Op.iLike : Op.like;
      const searchVal = `%${search.trim()}%`;
      whereClause[Op.or] = [
        { reason: { [searchOperator]: searchVal } },
        { '$user.display_name$': { [searchOperator]: searchVal } },
        { '$user.email$': { [searchOperator]: searchVal } },
        { '$role.name$': { [searchOperator]: searchVal } }
      ];
    }

    let orderArray = [['created_at', 'DESC']];
    const allowedSortFields = ['valid_from', 'valid_until', 'is_active', 'created_at', 'updated_at'];
    const orderDir = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    if (allowedSortFields.includes(sortBy)) {
      orderArray = [[sortBy, orderDir]];
    } else if (sortBy === 'user_email') {
      orderArray = [[{ model: User, as: 'user' }, 'email', orderDir]];
    } else if (sortBy === 'role_name') {
      orderArray = [[{ model: Role, as: 'role' }, 'name', orderDir]];
    }

    const { count, rows } = await UserRole.findAndCountAll({
      where: whereClause,
      include: [
        { model: User, as: 'user', attributes: ['id', 'email', 'display_name', 'first_name', 'last_name', 'avatar_url'] },
        { model: Role, as: 'role', attributes: ['id', 'name', 'slug', 'priority'] },
        { model: User, as: 'assigner', attributes: ['id', 'email', 'display_name'] }
      ],
      order: orderArray,
      limit: parseInt(limit),
      offset: parseInt(offset),
      subQuery: false
    });

    return {
      totalItems: count,
      userRoles: rows,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page)
    };
  }

  /**
   * Get a single assignment by ID
   */
  async getById(id) {
    const userRole = await UserRole.findByPk(id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'email', 'display_name', 'first_name', 'last_name', 'avatar_url'] },
        { model: Role, as: 'role', attributes: ['id', 'name', 'slug', 'priority'] },
        { model: User, as: 'assigner', attributes: ['id', 'email', 'display_name'] }
      ]
    });
    if (!userRole) {
      throw new Error(`User role assignment with ID ${id} not found.`);
    }
    return userRole;
  }

  /**
   * Create a new user role assignment
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

    // 2. Verify role exists
    if (!data.role_id) {
      throw new Error('role_id is required.');
    }
    const role = await Role.findByPk(data.role_id);
    if (!role) {
      throw new Error(`Role with ID ${data.role_id} does not exist.`);
    }

    // 3. Verify assigner if provided
    if (data.assigned_by) {
      const assigner = await User.findByPk(data.assigned_by);
      if (!assigner) {
        throw new Error(`Assigning User with ID ${data.assigned_by} does not exist.`);
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

    // 5. Unique active mapping validation
    const checkActive = data.is_active !== false;
    const hasExpiry = !!data.valid_until;
    if (checkActive && !hasExpiry) {
      const existingActive = await UserRole.findOne({
        where: {
          user_id: data.user_id,
          role_id: data.role_id,
          is_active: true,
          valid_until: null
        }
      });
      if (existingActive) {
        throw new Error('This user is already actively assigned to this role without an expiration date.');
      }
    }

    // 6. JSON Parse Helper for metadata
    if (data.metadata && typeof data.metadata === 'string') {
      try {
        data.metadata = JSON.parse(data.metadata);
      } catch (e) {
        throw new Error('Invalid JSON format provided for metadata.');
      }
    }

    const created = await UserRole.create(data);
    return await this.getById(created.id);
  }

  /**
   * Update a user role assignment
   */
  async update(id, data) {
    const userRole = await this.getById(id);

    // Validate user and role if modified
    if (data.user_id && data.user_id !== userRole.user_id) {
      const user = await User.findByPk(data.user_id);
      if (!user) {
        throw new Error(`User with ID ${data.user_id} does not exist.`);
      }
    }
    if (data.role_id && data.role_id !== userRole.role_id) {
      const role = await Role.findByPk(data.role_id);
      if (!role) {
        throw new Error(`Role with ID ${data.role_id} does not exist.`);
      }
    }
    if (data.assigned_by && data.assigned_by !== userRole.assigned_by) {
      const assigner = await User.findByPk(data.assigned_by);
      if (!assigner) {
        throw new Error(`Assigning User with ID ${data.assigned_by} does not exist.`);
      }
    }

    // Date validation
    const fromDate = data.valid_from ? new Date(data.valid_from) : new Date(userRole.valid_from);
    const untilDate = data.hasOwnProperty('valid_until') ? (data.valid_until ? new Date(data.valid_until) : null) : (userRole.valid_until ? new Date(userRole.valid_until) : null);
    if (untilDate && untilDate <= fromDate) {
      throw new Error('valid_until must be after valid_from.');
    }

    // Uniqueness validation
    const checkActive = data.hasOwnProperty('is_active') ? data.is_active : userRole.is_active;
    const checkUserId = data.user_id || userRole.user_id;
    const checkRoleId = data.role_id || userRole.role_id;
    
    if (checkActive !== false && !untilDate) {
      const existingActive = await UserRole.findOne({
        where: {
          user_id: checkUserId,
          role_id: checkRoleId,
          is_active: true,
          valid_until: null,
          id: { [Op.ne]: id }
        }
      });
      if (existingActive) {
        throw new Error('This user is already actively assigned to this role without an expiration date.');
      }
    }

    // JSON Parse Helper for metadata
    if (data.hasOwnProperty('metadata') && data.metadata && typeof data.metadata === 'string') {
      try {
        data.metadata = JSON.parse(data.metadata);
      } catch (e) {
        throw new Error('Invalid JSON format provided for metadata.');
      }
    }

    await userRole.update(data);
    return await this.getById(id);
  }

  /**
   * Delete a user role assignment
   */
  async delete(id) {
    const userRole = await this.getById(id);
    await userRole.destroy();
    return { id, message: 'User role assignment deleted successfully.' };
  }

  /**
   * Bulk delete assignments
   */
  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('No IDs provided for bulk deletion.');
    }

    const deletedCount = await UserRole.destroy({
      where: {
        id: ids
      }
    });

    return {
      deletedCount,
      message: `Successfully deleted ${deletedCount} user role assignments.`
    };
  }
}

module.exports = new UserRoleService();
