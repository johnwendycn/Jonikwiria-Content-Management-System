const actionTypeService = require('../services/actionTypeService');

class ActionTypeController {
  async getAll(req, res) {
    try {
      const { page, limit, search, sortBy, sortOrder } = req.query;
      const data = await actionTypeService.getAll({
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 10,
        search,
        sortBy,
        sortOrder
      });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('Error in getAll controller (ActionType):', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const actionType = await actionTypeService.getById(id);
      return res.status(200).json({ success: true, data: actionType });
    } catch (error) {
      console.error(`Error in getById controller for ActionType ID ${req.params.id}:`, error);
      const status = error.message.includes('not found') ? 404 : 500;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async create(req, res) {
    try {
      const { 
        name, 
        slug, 
        verb,
        description, 
        is_destructive, 
        requires_owner_permission, 
        log_level, 
        sort_order, 
        icon_class,
        is_system,
        created_by
      } = req.body;

      if (!name) {
        return res.status(400).json({ success: false, message: 'Name is a required field.' });
      }

      const newAction = await actionTypeService.create({
        name,
        slug,
        verb,
        description,
        is_destructive,
        requires_owner_permission,
        log_level,
        sort_order,
        icon_class,
        is_system,
        created_by
      });

      return res.status(201).json({ success: true, message: 'Action type created successfully.', data: newAction });
    } catch (error) {
      console.error('Error in create controller (ActionType):', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const updatedAction = await actionTypeService.update(id, req.body);
      return res.status(200).json({ success: true, message: 'Action type updated successfully.', data: updatedAction });
    } catch (error) {
      console.error(`Error in update controller for ActionType ID ${req.params.id}:`, error);
      const status = error.message.includes('not found') ? 404 : 400;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await actionTypeService.delete(id);
      return res.status(200).json({ success: true, message: result.message, data: { id: result.id } });
    } catch (error) {
      console.error(`Error in delete controller for ActionType ID ${req.params.id}:`, error);
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

      const result = await actionTypeService.bulkDelete(ids);
      return res.status(200).json({ success: true, message: result.message, data: { deletedCount: result.deletedCount } });
    } catch (error) {
      console.error('Error in bulkDelete controller (ActionType):', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}

module.exports = new ActionTypeController();
