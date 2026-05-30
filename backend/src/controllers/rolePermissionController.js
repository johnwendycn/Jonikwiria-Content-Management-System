const rolePermissionService = require('../services/rolePermissionService');

class RolePermissionController {
  async getAll(req, res) {
    try {
      const { page, limit, search, sortBy, sortOrder } = req.query;
      const data = await rolePermissionService.getAll({
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 10,
        search,
        sortBy,
        sortOrder
      });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('Error in getAll controller (RolePermission):', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const rolePermission = await rolePermissionService.getById(id);
      return res.status(200).json({ success: true, data: rolePermission });
    } catch (error) {
      console.error(`Error in getById controller for RolePermission ID ${req.params.id}:`, error);
      const status = error.message.includes('not found') ? 404 : 500;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async create(req, res) {
    try {
      const {
        role_id,
        permission_id,
        is_allowed,
        conditions,
        valid_from,
        valid_until,
        granted_by,
        reason,
        metadata
      } = req.body;

      if (!role_id) {
        return res.status(400).json({ success: false, message: 'Role ID is a required field.' });
      }
      if (!permission_id) {
        return res.status(400).json({ success: false, message: 'Permission ID is a required field.' });
      }

      const newRolePermission = await rolePermissionService.create({
        role_id,
        permission_id,
        is_allowed,
        conditions,
        valid_from,
        valid_until,
        granted_by,
        reason,
        metadata
      });

      return res.status(201).json({ success: true, message: 'Permission granted to role successfully.', data: newRolePermission });
    } catch (error) {
      console.error('Error in create controller (RolePermission):', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const updatedRolePermission = await rolePermissionService.update(id, req.body);
      return res.status(200).json({ success: true, message: 'Role permission mapping updated successfully.', data: updatedRolePermission });
    } catch (error) {
      console.error(`Error in update controller for RolePermission ID ${req.params.id}:`, error);
      const status = error.message.includes('not found') ? 404 : 400;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await rolePermissionService.delete(id);
      return res.status(200).json({ success: true, message: result.message, data: { id: result.id } });
    } catch (error) {
      console.error(`Error in delete controller for RolePermission ID ${req.params.id}:`, error);
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

      const result = await rolePermissionService.bulkDelete(ids);
      return res.status(200).json({ success: true, message: result.message, data: { deletedCount: result.deletedCount } });
    } catch (error) {
      console.error('Error in bulkDelete controller (RolePermission):', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}

module.exports = new RolePermissionController();
