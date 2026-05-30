const { Op } = require('sequelize');
const Permission = require('../models/permission');
const ResourceType = require('../models/resourceType');
const ActionType = require('../models/actionType');
const { isPostgres } = require('../config/database');

class PermissionService {
  /**
   * Get all permissions with pagination, filtering and sorting
   */
  async getAll({ page = 1, limit = 10, search = '', sortBy = 'created_at', sortOrder = 'DESC' }) {
    const offset = (page - 1) * limit;
    const whereClause = {};

    if (search && search.trim() !== '') {
      const searchOperator = isPostgres ? Op.iLike : Op.like;
      const searchVal = `%${search.trim()}%`;
      whereClause[Op.or] = [
        { name: { [searchOperator]: searchVal } },
        { description: { [searchOperator]: searchVal } },
        { '$resourceType.name$': { [searchOperator]: searchVal } },
        { '$actionType.name$': { [searchOperator]: searchVal } }
      ];
    }

    // Setup order array for Sequelize
    let orderArray = [['created_at', 'DESC']];
    const allowedSortFields = ['name', 'description', 'is_conditional', 'is_default', 'created_at', 'updated_at'];
    const orderDir = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    if (allowedSortFields.includes(sortBy)) {
      orderArray = [[sortBy, orderDir]];
    } else if (sortBy === 'resource_name') {
      orderArray = [[{ model: ResourceType, as: 'resourceType' }, 'name', orderDir]];
    } else if (sortBy === 'action_name') {
      orderArray = [[{ model: ActionType, as: 'actionType' }, 'name', orderDir]];
    }

    const { count, rows } = await Permission.findAndCountAll({
      where: whereClause,
      include: [
        { model: ResourceType, as: 'resourceType' },
        { model: ActionType, as: 'actionType' }
      ],
      order: orderArray,
      limit: parseInt(limit),
      offset: parseInt(offset),
      subQuery: false
    });

    return {
      totalItems: count,
      permissions: rows,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page)
    };
  }

  /**
   * Get a single permission by ID
   */
  async getById(id) {
    const permission = await Permission.findByPk(id, {
      include: [
        { model: ResourceType, as: 'resourceType' },
        { model: ActionType, as: 'actionType' }
      ]
    });
    if (!permission) {
      throw new Error(`Permission with ID ${id} not found.`);
    }
    return permission;
  }

  /**
   * Create a new permission
   */
  async create(data) {
    if (!data.resource_type_id) {
      throw new Error('resource_type_id is required.');
    }
    if (!data.action_type_id) {
      throw new Error('action_type_id is required.');
    }

    // Verify Resource and Action exist
    const resource = await ResourceType.findByPk(data.resource_type_id);
    if (!resource) {
      throw new Error(`Resource type with ID ${data.resource_type_id} does not exist.`);
    }

    const action = await ActionType.findByPk(data.action_type_id);
    if (!action) {
      throw new Error(`Action type with ID ${data.action_type_id} does not exist.`);
    }

    // Check composite duplicate
    const duplicatePair = await Permission.findOne({
      where: {
        resource_type_id: data.resource_type_id,
        action_type_id: data.action_type_id
      }
    });
    if (duplicatePair) {
      throw new Error(`A permission mapping the action '${action.name}' on resource '${resource.name}' already exists.`);
    }

    // Auto generate name if not provided
    if (!data.name || data.name.trim() === '') {
      data.name = `${action.name} on ${resource.name}`;
    }

    // Check name uniqueness
    const duplicateName = await Permission.findOne({ where: { name: data.name } });
    if (duplicateName) {
      throw new Error(`A permission with the name '${data.name}' already exists.`);
    }

    const createdPermission = await Permission.create(data);
    return await this.getById(createdPermission.id);
  }

  /**
   * Update a permission
   */
  async update(id, data) {
    const permission = await this.getById(id);

    const resourceId = data.resource_type_id || permission.resource_type_id;
    const actionId = data.action_type_id || permission.action_type_id;

    const resourceChanged = data.resource_type_id && data.resource_type_id !== permission.resource_type_id;
    const actionChanged = data.action_type_id && data.action_type_id !== permission.action_type_id;

    if (resourceChanged || actionChanged) {
      const resource = await ResourceType.findByPk(resourceId);
      if (!resource) {
        throw new Error(`Resource type with ID ${resourceId} does not exist.`);
      }

      const action = await ActionType.findByPk(actionId);
      if (!action) {
        throw new Error(`Action type with ID ${actionId} does not exist.`);
      }

      // Check duplicate composite pair
      const duplicatePair = await Permission.findOne({
        where: {
          resource_type_id: resourceId,
          action_type_id: actionId,
          id: { [Op.ne]: id }
        }
      });
      if (duplicatePair) {
        throw new Error(`A permission mapping the action '${action.name}' on resource '${resource.name}' already exists.`);
      }

      // If name is blank or was not custom defined, regenerate name
      if (!data.name || data.name.trim() === '') {
        data.name = `${action.name} on ${resource.name}`;
      }
    } else {
      // User blanked name, regenerate from current associations
      if (data.name === '') {
        const resource = await ResourceType.findByPk(resourceId);
        const action = await ActionType.findByPk(actionId);
        data.name = `${action.name} on ${resource.name}`;
      }
    }

    // Check name uniqueness if changed
    if (data.name && data.name !== permission.name) {
      const duplicateName = await Permission.findOne({
        where: {
          name: data.name,
          id: { [Op.ne]: id }
        }
      });
      if (duplicateName) {
        throw new Error(`A permission with the name '${data.name}' already exists.`);
      }
    }

    await permission.update(data);
    return await this.getById(id);
  }

  /**
   * Delete a permission
   */
  async delete(id) {
    const permission = await this.getById(id);
    await permission.destroy();
    return { id, message: 'Permission mapping deleted successfully.' };
  }

  /**
   * Bulk delete permissions
   */
  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('No IDs provided for bulk deletion.');
    }

    const deletedCount = await Permission.destroy({
      where: {
        id: ids
      }
    });

    return {
      deletedCount,
      message: `Successfully deleted ${deletedCount} permissions.`
    };
  }
}

module.exports = new PermissionService();
