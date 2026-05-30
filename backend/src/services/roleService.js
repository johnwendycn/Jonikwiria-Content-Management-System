const { Op } = require('sequelize');
const Role = require('../models/role');
const RoleType = require('../models/roleType');
const { isPostgres } = require('../config/database');

class RoleService {
  /**
   * Helper function to detect circular hierarchy loops.
   * Returns true if candidateParentId is a descendant of childId.
   */
  async isDescendant(candidateParentId, childId) {
    let currentParentId = candidateParentId;
    while (currentParentId) {
      if (currentParentId === childId) {
        return true;
      }
      const parentRole = await Role.findByPk(currentParentId, { attributes: ['parent_role_id'] });
      if (!parentRole) break;
      currentParentId = parentRole.parent_role_id;
    }
    return false;
  }

  /**
   * Get all roles with pagination, filtering and sorting
   */
  async getAll({ page = 1, limit = 10, search = '', sortBy = 'priority', sortOrder = 'DESC' }) {
    const offset = (page - 1) * limit;
    const whereClause = {};

    if (search && search.trim() !== '') {
      const searchOperator = isPostgres ? Op.iLike : Op.like;
      const searchVal = `%${search.trim()}%`;
      whereClause[Op.or] = [
        { name: { [searchOperator]: searchVal } },
        { slug: { [searchOperator]: searchVal } },
        { description: { [searchOperator]: searchVal } },
        { '$roleType.name$': { [searchOperator]: searchVal } },
        { '$parent.name$': { [searchOperator]: searchVal } }
      ];
    }

    // Sorting parameters
    let orderArray = [['priority', 'DESC'], ['name', 'ASC']];
    const allowedSortFields = [
      'name', 'slug', 'description', 'is_active', 'is_default', 'priority', 
      'valid_from', 'valid_until', 'created_at', 'updated_at'
    ];
    const orderDir = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'ASC';

    if (allowedSortFields.includes(sortBy)) {
      orderArray = [[sortBy, orderDir]];
    } else if (sortBy === 'role_type_name') {
      orderArray = [[{ model: RoleType, as: 'roleType' }, 'name', orderDir]];
    } else if (sortBy === 'parent_role_name') {
      orderArray = [[{ model: Role, as: 'parent' }, 'name', orderDir]];
    }

    const { count, rows } = await Role.findAndCountAll({
      where: whereClause,
      include: [
        { model: RoleType, as: 'roleType' },
        { model: Role, as: 'parent' }
      ],
      order: orderArray,
      limit: parseInt(limit),
      offset: parseInt(offset),
      subQuery: false
    });

    return {
      totalItems: count,
      roles: rows,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page)
    };
  }

  /**
   * Get a single role by ID
   */
  async getById(id) {
    const role = await Role.findByPk(id, {
      include: [
        { model: RoleType, as: 'roleType' },
        { model: Role, as: 'parent' }
      ]
    });
    if (!role) {
      throw new Error(`Role with ID ${id} not found.`);
    }
    return role;
  }

  /**
   * Create a new role
   */
  async create(data) {
    // Generate slug from name if not provided
    if (!data.slug && data.name) {
      data.slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    // Verify role type exists
    if (!data.role_type_id) {
      throw new Error('role_type_id is required.');
    }
    const roleType = await RoleType.findByPk(data.role_type_id);
    if (!roleType) {
      throw new Error(`Role Type with ID ${data.role_type_id} does not exist.`);
    }

    // Check parent loop
    if (data.parent_role_id) {
      const parent = await Role.findByPk(data.parent_role_id);
      if (!parent) {
        throw new Error(`Parent Role with ID ${data.parent_role_id} does not exist.`);
      }
    }

    // Unique constraints checks
    if (data.name) {
      const existingName = await Role.findOne({ where: { name: data.name } });
      if (existingName) {
        throw new Error(`A role with the name '${data.name}' already exists.`);
      }
    }

    if (data.slug) {
      const existingSlug = await Role.findOne({ where: { slug: data.slug } });
      if (existingSlug) {
        throw new Error(`A role with the slug '${data.slug}' already exists.`);
      }
    }

    // Parse and validate metadata if present
    if (data.metadata) {
      if (typeof data.metadata === 'string') {
        try {
          data.metadata = JSON.parse(data.metadata);
        } catch (e) {
          throw new Error('Invalid JSON format provided for metadata.');
        }
      }
    }

    const createdRole = await Role.create(data);
    return await this.getById(createdRole.id);
  }

  /**
   * Update a role
   */
  async update(id, data) {
    const role = await this.getById(id);

    // Slug generation from name if updated and slug not specified
    if (data.name && !data.slug && data.name !== role.name) {
      data.slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    // Verify role type exists if updated
    if (data.role_type_id && data.role_type_id !== role.role_type_id) {
      const roleType = await RoleType.findByPk(data.role_type_id);
      if (!roleType) {
        throw new Error(`Role Type with ID ${data.role_type_id} does not exist.`);
      }
    }

    // Check parent cycle loop
    if (data.parent_role_id) {
      if (data.parent_role_id === id) {
        throw new Error('A role cannot be its own parent.');
      }
      
      const parent = await Role.findByPk(data.parent_role_id);
      if (!parent) {
        throw new Error(`Parent Role with ID ${data.parent_role_id} does not exist.`);
      }

      // Deep circular cycle check
      const circularLoopDetected = await this.isDescendant(data.parent_role_id, id);
      if (circularLoopDetected) {
        throw new Error(`Circular inheritance detected: Parent Role is already a descendant of this role.`);
      }
    }

    // Unique constraints
    if (data.name && data.name !== role.name) {
      const existingName = await Role.findOne({ where: { name: data.name, id: { [Op.ne]: id } } });
      if (existingName) {
        throw new Error(`A role with the name '${data.name}' already exists.`);
      }
    }

    if (data.slug && data.slug !== role.slug) {
      const existingSlug = await Role.findOne({ where: { slug: data.slug, id: { [Op.ne]: id } } });
      if (existingSlug) {
        throw new Error(`A role with the slug '${data.slug}' already exists.`);
      }
    }

    // Parse and validate metadata if present
    if (data.metadata) {
      if (typeof data.metadata === 'string') {
        try {
          data.metadata = JSON.parse(data.metadata);
        } catch (e) {
          throw new Error('Invalid JSON format provided for metadata.');
        }
      }
    }

    await role.update(data);
    return await this.getById(id);
  }

  /**
   * Delete a role
   */
  async delete(id) {
    const role = await this.getById(id);
    await role.destroy();
    return { id, message: 'Role deleted successfully.' };
  }

  /**
   * Bulk delete roles
   */
  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('No IDs provided for bulk deletion.');
    }

    const deletedCount = await Role.destroy({
      where: {
        id: ids
      }
    });

    return {
      deletedCount,
      message: `Successfully deleted ${deletedCount} roles.`
    };
  }
}

module.exports = new RoleService();
