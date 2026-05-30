const permissionService = require('../services/permissionService');

class PermissionController {
  async getAll(req, res) {
    try {
      const { page, limit, search, sortBy, sortOrder } = req.query;
      const data = await permissionService.getAll({
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 10,
        search,
        sortBy,
        sortOrder
      });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('Error in getAll controller (Permission):', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const permission = await permissionService.getById(id);
      return res.status(200).json({ success: true, data: permission });
    } catch (error) {
      console.error(`Error in getById controller for Permission ID ${req.params.id}:`, error);
      const status = error.message.includes('not found') ? 404 : 500;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async create(req, res) {
    try {
      const { 
        resource_type_id, 
        action_type_id, 
        name, 
        description, 
        is_conditional, 
        is_default, 
        created_by 
      } = req.body;

      if (!resource_type_id) {
        return res.status(400).json({ success: false, message: 'Resource type ID is required.' });
      }
      if (!action_type_id) {
        return res.status(400).json({ success: false, message: 'Action type ID is required.' });
      }

      const newPermission = await permissionService.create({
        resource_type_id,
        action_type_id,
        name,
        description,
        is_conditional,
        is_default,
        created_by
      });

      return res.status(201).json({ success: true, message: 'Permission mapped successfully.', data: newPermission });
    } catch (error) {
      console.error('Error in create controller (Permission):', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const updatedPermission = await permissionService.update(id, req.body);
      return res.status(200).json({ success: true, message: 'Permission updated successfully.', data: updatedPermission });
    } catch (error) {
      console.error(`Error in update controller for Permission ID ${req.params.id}:`, error);
      const status = error.message.includes('not found') ? 404 : 400;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await permissionService.delete(id);
      return res.status(200).json({ success: true, message: result.message, data: { id: result.id } });
    } catch (error) {
      console.error(`Error in delete controller for Permission ID ${req.params.id}:`, error);
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

      const result = await permissionService.bulkDelete(ids);
      return res.status(200).json({ success: true, message: result.message, data: { deletedCount: result.deletedCount } });
    } catch (error) {
      console.error('Error in bulkDelete controller (Permission):', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}

module.exports = new PermissionController();
