const userRoleService = require('../services/userRoleService');

class UserRoleController {
  async getAll(req, res) {
    try {
      const { page, limit, search, sortBy, sortOrder } = req.query;
      const data = await userRoleService.getAll({
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 10,
        search,
        sortBy,
        sortOrder
      });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('Error in getAll controller (UserRole):', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const userRole = await userRoleService.getById(id);
      return res.status(200).json({ success: true, data: userRole });
    } catch (error) {
      console.error(`Error in getById controller for UserRole ID ${req.params.id}:`, error);
      const status = error.message.includes('not found') ? 404 : 500;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async create(req, res) {
    try {
      const {
        user_id,
        role_id,
        valid_from,
        valid_until,
        is_active,
        assigned_by,
        reason,
        metadata
      } = req.body;

      if (!user_id) {
        return res.status(400).json({ success: false, message: 'User ID is a required field.' });
      }
      if (!role_id) {
        return res.status(400).json({ success: false, message: 'Role ID is a required field.' });
      }

      const newUserRole = await userRoleService.create({
        user_id,
        role_id,
        valid_from,
        valid_until,
        is_active,
        assigned_by,
        reason,
        metadata
      });

      return res.status(201).json({ success: true, message: 'User role assigned successfully.', data: newUserRole });
    } catch (error) {
      console.error('Error in create controller (UserRole):', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const updatedUserRole = await userRoleService.update(id, req.body);
      return res.status(200).json({ success: true, message: 'User role assignment updated successfully.', data: updatedUserRole });
    } catch (error) {
      console.error(`Error in update controller for UserRole ID ${req.params.id}:`, error);
      const status = error.message.includes('not found') ? 404 : 400;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await userRoleService.delete(id);
      return res.status(200).json({ success: true, message: result.message, data: { id: result.id } });
    } catch (error) {
      console.error(`Error in delete controller for UserRole ID ${req.params.id}:`, error);
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

      const result = await userRoleService.bulkDelete(ids);
      return res.status(200).json({ success: true, message: result.message, data: { deletedCount: result.deletedCount } });
    } catch (error) {
      console.error('Error in bulkDelete controller (UserRole):', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}

module.exports = new UserRoleController();
