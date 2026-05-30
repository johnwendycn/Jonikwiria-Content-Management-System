const { Op } = require('sequelize');
const ResourceType = require('../models/resourceType');
const { isPostgres } = require('../config/database');

class ResourceTypeService {
  /**
   * Get all resource types with pagination, filtering and sorting
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
        { table_name: { [searchOperator]: searchVal } }
      ];
    }

    // Validate sorting parameters to avoid SQL injection
    const allowedSortFields = [
      'name', 'slug', 'table_name', 'sort_order', 'created_at', 'updated_at', 
      'supports_conditions', 'supports_ownership', 'supports_hierarchy', 'requires_approval', 'is_system'
    ];
    const orderField = allowedSortFields.includes(sortBy) ? sortBy : 'sort_order';
    const orderDir = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'ASC';

    const { count, rows } = await ResourceType.findAndCountAll({
      where: whereClause,
      order: [[orderField, orderDir]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return {
      totalItems: count,
      resourceTypes: rows,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page)
    };
  }

  /**
   * Get a single resource type by ID
   */
  async getById(id) {
    const resourceType = await ResourceType.findByPk(id);
    if (!resourceType) {
      throw new Error(`Resource type with ID ${id} not found.`);
    }
    return resourceType;
  }

  /**
   * Create a new resource type
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
      const existingName = await ResourceType.findOne({ where: { name: data.name } });
      if (existingName) {
        throw new Error(`A resource type with the name '${data.name}' already exists.`);
      }
    }

    if (data.slug) {
      const existingSlug = await ResourceType.findOne({ where: { slug: data.slug } });
      if (existingSlug) {
        throw new Error(`A resource type with the slug '${data.slug}' already exists.`);
      }
    }

    return await ResourceType.create(data);
  }

  /**
   * Update a resource type
   */
  async update(id, data) {
    const resourceType = await this.getById(id);

    // Safeguard system resources from slug/name/system status overrides
    if (resourceType.is_system) {
      if (data.name && data.name !== resourceType.name) {
        throw new Error('Cannot rename a system-defined resource type.');
      }
      if (data.slug && data.slug !== resourceType.slug) {
        throw new Error('Cannot change the slug of a system-defined resource type.');
      }
      if (data.is_system === false) {
        throw new Error('Cannot change system resource designation.');
      }
    }

    // Update slug if name changes and slug not explicitly updated
    if (data.name && !data.slug && data.name !== resourceType.name) {
      data.slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    // Check unique constraints
    if (data.name && data.name !== resourceType.name) {
      const existingName = await ResourceType.findOne({ where: { name: data.name } });
      if (existingName) {
        throw new Error(`A resource type with the name '${data.name}' already exists.`);
      }
    }

    if (data.slug && data.slug !== resourceType.slug) {
      const existingSlug = await ResourceType.findOne({ where: { slug: data.slug } });
      if (existingSlug) {
        throw new Error(`A resource type with the slug '${data.slug}' already exists.`);
      }
    }

    await resourceType.update(data);
    return resourceType;
  }

  /**
   * Delete a resource type
   */
  async delete(id) {
    const resourceType = await this.getById(id);
    
    if (resourceType.is_system) {
      throw new Error('System-defined resource types cannot be deleted.');
    }

    await resourceType.destroy();
    return { id, message: 'Resource type deleted successfully.' };
  }

  /**
   * Bulk delete resource types
   */
  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('No IDs provided for bulk deletion.');
    }

    // Find if any of them are system resources
    const systemResourceTypes = await ResourceType.findAll({
      where: {
        id: ids,
        is_system: true
      }
    });

    if (systemResourceTypes.length > 0) {
      const systemNames = systemResourceTypes.map(s => s.name).join(', ');
      throw new Error(`Cannot delete system-defined resource types: [ ${systemNames} ]. Operations aborted.`);
    }

    const deletedCount = await ResourceType.destroy({
      where: {
        id: ids
      }
    });

    return {
      deletedCount,
      message: `Successfully deleted ${deletedCount} resource types.`
    };
  }
}

module.exports = new ResourceTypeService();
