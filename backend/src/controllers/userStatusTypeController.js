const userStatusTypeService = require('../services/userStatusTypeService');

class UserStatusTypeController {
  async getAll(req, res) {
    try {
      const { page, limit, search, sortBy, sortOrder } = req.query;
      const data = await userStatusTypeService.getAll({
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 10,
        search,
        sortBy,
        sortOrder
      });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('Error in getAll controller:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const statusType = await userStatusTypeService.getById(id);
      return res.status(200).json({ success: true, data: statusType });
    } catch (error) {
      console.error(`Error in getById controller for ID ${req.params.id}:`, error);
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
        is_active_state, 
        allows_login, 
        allows_api_access, 
        is_locked_state, 
        is_terminal_state, 
        color_class, 
        icon_class, 
        sort_order, 
        next_allowed_statuses, 
        requires_reason, 
        auto_transition_after,
        is_system,
        created_by
      } = req.body;

      if (!name) {
        return res.status(400).json({ success: false, message: 'Name is a required field.' });
      }

      const newStatus = await userStatusTypeService.create({
        name,
        slug,
        description,
        is_active_state,
        allows_login,
        allows_api_access,
        is_locked_state,
        is_terminal_state,
        color_class,
        icon_class,
        sort_order,
        next_allowed_statuses,
        requires_reason,
        auto_transition_after,
        is_system,
        created_by
      });

      return res.status(201).json({ success: true, message: 'User status type created successfully.', data: newStatus });
    } catch (error) {
      console.error('Error in create controller:', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const updatedStatus = await userStatusTypeService.update(id, req.body);
      return res.status(200).json({ success: true, message: 'User status type updated successfully.', data: updatedStatus });
    } catch (error) {
      console.error(`Error in update controller for ID ${req.params.id}:`, error);
      const status = error.message.includes('not found') ? 404 : 400;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await userStatusTypeService.delete(id);
      return res.status(200).json({ success: true, message: result.message, data: { id: result.id } });
    } catch (error) {
      console.error(`Error in delete controller for ID ${req.params.id}:`, error);
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

      const result = await userStatusTypeService.bulkDelete(ids);
      return res.status(200).json({ success: true, message: result.message, data: { deletedCount: result.deletedCount } });
    } catch (error) {
      console.error('Error in bulkDelete controller:', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}

module.exports = new UserStatusTypeController();
