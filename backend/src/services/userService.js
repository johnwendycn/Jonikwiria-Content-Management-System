const { Op } = require('sequelize');
const User = require('../models/user');
const UserStatusType = require('../models/userStatusType');
const { isPostgres } = require('../config/database');

class UserService {
  /**
   * Get all users with pagination, filtering and sorting
   */
  async getAll({ page = 1, limit = 10, search = '', sortBy = 'created_at', sortOrder = 'DESC', showDeleted = false }) {
    const offset = (page - 1) * limit;
    const whereClause = {};

    if (search && search.trim() !== '') {
      const searchOperator = isPostgres ? Op.iLike : Op.like;
      const searchVal = `%${search.trim()}%`;
      whereClause[Op.or] = [
        { email: { [searchOperator]: searchVal } },
        { display_name: { [searchOperator]: searchVal } },
        { first_name: { [searchOperator]: searchVal } },
        { last_name: { [searchOperator]: searchVal } },
        { cost_center: { [searchOperator]: searchVal } },
        { '$statusType.name$': { [searchOperator]: searchVal } }
      ];
    }

    // Set sorting columns
    let orderArray = [['created_at', 'DESC']];
    const allowedSortFields = ['email', 'display_name', 'last_login_at', 'security_clearance', 'created_at', 'updated_at'];
    const orderDir = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    if (allowedSortFields.includes(sortBy)) {
      orderArray = [[sortBy, orderDir]];
    } else if (sortBy === 'status_name') {
      orderArray = [[{ model: UserStatusType, as: 'statusType' }, 'name', orderDir]];
    }

    const { count, rows } = await User.findAndCountAll({
      where: whereClause,
      include: [
        { model: UserStatusType, as: 'statusType' }
      ],
      order: orderArray,
      limit: parseInt(limit),
      offset: parseInt(offset),
      paranoid: !showDeleted, // showDeleted = true enables searching soft-deleted users
      subQuery: false
    });

    return {
      totalItems: count,
      users: rows,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page)
    };
  }

  /**
   * Get a single user by ID
   */
  async getById(id, includeDeleted = false) {
    const user = await User.findByPk(id, {
      include: [{ model: UserStatusType, as: 'statusType' }],
      paranoid: !includeDeleted
    });
    if (!user) {
      throw new Error(`User with ID ${id} not found.`);
    }
    return user;
  }

  /**
   * Create a new user
   */
  async create(data) {
    // Validate email format
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!data.email || !emailRegex.test(data.email)) {
      throw new Error('Please enter a valid email address.');
    }

    // Validate password hash cannot be empty
    if (!data.password_hash || data.password_hash.trim() === '') {
      throw new Error('Password hash cannot be empty.');
    }

    // Verify status type exists
    if (!data.status_id) {
      throw new Error('status_id is required.');
    }
    const statusType = await UserStatusType.findByPk(data.status_id);
    if (!statusType) {
      throw new Error(`User Status Type with ID ${data.status_id} does not exist.`);
    }

    // Unique email check (including soft deleted since DB column unique index hits all rows)
    const existingUser = await User.findOne({
      where: { email: data.email },
      paranoid: false
    });
    if (existingUser) {
      throw new Error(`A user with the email '${data.email}' already exists.`);
    }

    // Handle JSON parser helper
    if (data.preferences && typeof data.preferences === 'string') {
      try {
        data.preferences = JSON.parse(data.preferences);
      } catch (e) {
        throw new Error('Invalid JSON format provided for preferences.');
      }
    }
    if (data.allowed_ips && typeof data.allowed_ips === 'string') {
      try {
        data.allowed_ips = JSON.parse(data.allowed_ips);
      } catch (e) {
        throw new Error('Invalid JSON format provided for allowed IPs.');
      }
    }

    const createdUser = await User.create(data);
    return await this.getById(createdUser.id);
  }

  /**
   * Update a user
   */
  async update(id, data) {
    // Find user including deleted in case they are modifying a deleted user (or we block it)
    const user = await this.getById(id, true);

    // Email validates if changing
    if (data.email && data.email !== user.email) {
      const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
      if (!emailRegex.test(data.email)) {
        throw new Error('Please enter a valid email address.');
      }

      const existingUser = await User.findOne({
        where: { email: data.email, id: { [Op.ne]: id } },
        paranoid: false
      });
      if (existingUser) {
        throw new Error(`A user with the email '${data.email}' already exists.`);
      }
    }

    // Password validates if updated
    if (data.hasOwnProperty('password_hash') && (!data.password_hash || data.password_hash.trim() === '')) {
      throw new Error('Password hash cannot be empty.');
    }

    // Verify status type if updated
    if (data.status_id && data.status_id !== user.status_id) {
      const statusType = await UserStatusType.findByPk(data.status_id);
      if (!statusType) {
        throw new Error(`User Status Type with ID ${data.status_id} does not exist.`);
      }
    }

    // Parse JSON configurations
    if (data.preferences && typeof data.preferences === 'string') {
      try {
        data.preferences = JSON.parse(data.preferences);
      } catch (e) {
        throw new Error('Invalid JSON format provided for preferences.');
      }
    }
    if (data.allowed_ips && typeof data.allowed_ips === 'string') {
      try {
        data.allowed_ips = JSON.parse(data.allowed_ips);
      } catch (e) {
        throw new Error('Invalid JSON format provided for allowed IPs.');
      }
    }

    await user.update(data);
    return await this.getById(id, true);
  }

  /**
   * Soft delete a user
   */
  async delete(id) {
    const user = await this.getById(id);
    await user.destroy(); // Sequelize destroy on paranoid model soft-deletes
    return { id, message: 'User soft-deleted successfully.' };
  }

  /**
   * Restore a soft-deleted user
   */
  async restore(id) {
    const user = await User.findByPk(id, { paranoid: false });
    if (!user) {
      throw new Error(`User with ID ${id} not found.`);
    }
    if (!user.deleted_at) {
      throw new Error('User is not soft-deleted.');
    }
    await user.restore();
    return await this.getById(id);
  }

  /**
   * Bulk soft-delete users
   */
  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('No IDs provided for bulk deletion.');
    }

    const deletedCount = await User.destroy({
      where: {
        id: ids
      }
    });

    return {
      deletedCount,
      message: `Successfully soft-deleted ${deletedCount} users.`
    };
  }
}

module.exports = new UserService();
