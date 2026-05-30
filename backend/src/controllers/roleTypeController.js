const roleTypeService = require('../services/roleTypeService');

class RoleTypeController {
  async getAll(req, res) {
    try {
      const { page, limit, search, sortBy, sortOrder } = req.query;
      const data = await roleTypeService.getAll({
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 10,
        search,
        sortBy,
        sortOrder
      });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('Error in getAll controller (RoleType):', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const roleType = await roleTypeService.getById(id);
      return res.status(200).json({ success: true, data: roleType });
    } catch (error) {
      console.error(`Error in getById controller for RoleType ID ${req.params.id}:`, error);
      const status = error.message.includes('not found') ? 404 : 500;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async create(req, res) {
    try {
      const { 
        name, 
        slug, 
        description, 
        is_system_role, 
        is_assignable, 
        is_hierarchical, 
        allows_custom_permissions, 
        color_class, 
        icon_class, 
        sort_order, 
        max_assignment_per_user, 
        auto_assign_on_register,
        created_by
      } = req.body;

      if (!name) {
        return res.status(400).json({ success: false, message: 'Name is a required field.' });
      }

      const newRole = await roleTypeService.create({
        name,
        slug,
        description,
        is_system_role,
        is_assignable,
        is_hierarchical,
        allows_custom_permissions,
        color_class,
        icon_class,
        sort_order,
        max_assignment_per_user: max_assignment_per_user === '' ? null : (parseInt(max_assignment_per_user) || null),
        auto_assign_on_register,
        created_by
      });

      return res.status(201).json({ success: true, message: 'Role type created successfully.', data: newRole });
    } catch (error) {
      console.error('Error in create controller (RoleType):', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const updatedRole = await roleTypeService.update(id, req.body);
      return res.status(200).json({ success: true, message: 'Role type updated successfully.', data: updatedRole });
    } catch (error) {
      console.error(`Error in update controller for RoleType ID ${req.params.id}:`, error);
      const status = error.message.includes('not found') ? 404 : 400;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await roleTypeService.delete(id);
      return res.status(200).json({ success: true, message: result.message, data: { id: result.id } });
    } catch (error) {
      console.error(`Error in delete controller for RoleType ID ${req.params.id}:`, error);
      const status = error.message.includes('not found') ? 404 : 400;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async bulkDelete(req, res) {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid or empty IDs array provided.' });
      }

      const result = await roleTypeService.bulkDelete(ids);
      return res.status(200).json({ success: true, message: result.message, data: { deletedCount: result.deletedCount } });
    } catch (error) {
      console.error('Error in bulkDelete controller (RoleType):', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}

module.exports = new RoleTypeController();
