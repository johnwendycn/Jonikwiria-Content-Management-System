const roleService = require('../services/roleService');

class RoleController {
  async getAll(req, res) {
    try {
      const { page, limit, search, sortBy, sortOrder } = req.query;
      const data = await roleService.getAll({
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 10,
        search,
        sortBy,
        sortOrder
      });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('Error in getAll controller (Role):', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const role = await roleService.getById(id);
      return res.status(200).json({ success: true, data: role });
    } catch (error) {
      console.error(`Error in getById controller for Role ID ${req.params.id}:`, error);
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
        role_type_id, 
        parent_role_id, 
        is_active, 
        is_default, 
        priority, 
        valid_from, 
        valid_until, 
        metadata,
        created_by 
      } = req.body;

      if (!name) {
        return res.status(400).json({ success: false, message: 'Name is a required field.' });
      }
      if (!role_type_id) {
        return res.status(400).json({ success: false, message: 'Role type ID is required.' });
      }

      const newRole = await roleService.create({
        name,
        slug,
        description,
        role_type_id,
        parent_role_id,
        is_active,
        is_default,
        priority: priority ? parseInt(priority) : 0,
        valid_from,
        valid_until,
        metadata,
        created_by
      });

      return res.status(201).json({ success: true, message: 'Role created successfully.', data: newRole });
    } catch (error) {
      console.error('Error in create controller (Role):', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const updatedRole = await roleService.update(id, req.body);
      return res.status(200).json({ success: true, message: 'Role updated successfully.', data: updatedRole });
    } catch (error) {
      console.error(`Error in update controller for Role ID ${req.params.id}:`, error);
      const status = error.message.includes('not found') ? 404 : 400;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await roleService.delete(id);
      return res.status(200).json({ success: true, message: result.message, data: { id: result.id } });
    } catch (error) {
      console.error(`Error in delete controller for Role ID ${req.params.id}:`, error);
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

      const result = await roleService.bulkDelete(ids);
      return res.status(200).json({ success: true, message: result.message, data: { deletedCount: result.deletedCount } });
    } catch (error) {
      console.error('Error in bulkDelete controller (Role):', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}

module.exports = new RoleController();
