const userPermissionService = require('../services/userPermissionService');

class UserPermissionController {
  async getAll(req, res) {
    try {
      const { page, limit, search, sortBy, sortOrder } = req.query;
      const data = await userPermissionService.getAll({
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 10,
        search,
        sortBy,
        sortOrder
      });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('Error in getAll controller (UserPermission):', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const userPermission = await userPermissionService.getById(id);
      return res.status(200).json({ success: true, data: userPermission });
    } catch (error) {
      console.error(`Error in getById controller for UserPermission ID ${req.params.id}:`, error);
      const status = error.message.includes('not found') ? 404 : 500;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async create(req, res) {
    try {
      const {
        user_id,
        permission_id,
        is_allowed,
        conditions,
        valid_from,
        valid_until,
        granted_by,
        reason,
        metadata
      } = req.body;

      if (!user_id) {
        return res.status(400).json({ success: false, message: 'User ID is a required field.' });
      }
      if (!permission_id) {
        return res.status(400).json({ success: false, message: 'Permission ID is a required field.' });
      }

      const newUserPermission = await userPermissionService.create({
        user_id,
        permission_id,
        is_allowed,
        conditions,
        valid_from,
        valid_until,
        granted_by,
        reason,
        metadata
      });

      return res.status(201).json({ success: true, message: 'Permission granted to user successfully.', data: newUserPermission });
    } catch (error) {
      console.error('Error in create controller (UserPermission):', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const updatedUserPermission = await userPermissionService.update(id, req.body);
      return res.status(200).json({ success: true, message: 'User permission mapping updated successfully.', data: updatedUserPermission });
    } catch (error) {
      console.error(`Error in update controller for UserPermission ID ${req.params.id}:`, error);
      const status = error.message.includes('not found') ? 404 : 400;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await userPermissionService.delete(id);
      return res.status(200).json({ success: true, message: result.message, data: { id: result.id } });
    } catch (error) {
      console.error(`Error in delete controller for UserPermission ID ${req.params.id}:`, error);
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

      const result = await userPermissionService.bulkDelete(ids);
      return res.status(200).json({ success: true, message: result.message, data: { deletedCount: result.deletedCount } });
    } catch (error) {
      console.error('Error in bulkDelete controller (UserPermission):', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}

module.exports = new UserPermissionController();
