const resourceTypeService = require('../services/resourceTypeService');

class ResourceTypeController {
  async getAll(req, res) {
    try {
      const { page, limit, search, sortBy, sortOrder } = req.query;
      const data = await resourceTypeService.getAll({
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 10,
        search,
        sortBy,
        sortOrder
      });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('Error in getAll controller (ResourceType):', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const resourceType = await resourceTypeService.getById(id);
      return res.status(200).json({ success: true, data: resourceType });
    } catch (error) {
      console.error(`Error in getById controller for ResourceType ID ${req.params.id}:`, error);
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
        supports_conditions, 
        supports_ownership, 
        supports_hierarchy, 
        requires_approval, 
        icon_class,
        color_class,
        table_name,
        sort_order,
        is_system,
        created_by
      } = req.body;

      if (!name) {
        return res.status(400).json({ success: false, message: 'Name is a required field.' });
      }

      const newResource = await resourceTypeService.create({
        name,
        slug,
        description,
        supports_conditions,
        supports_ownership,
        supports_hierarchy,
        requires_approval,
        icon_class,
        color_class,
        table_name,
        sort_order,
        is_system,
        created_by
      });

      return res.status(201).json({ success: true, message: 'Resource type created successfully.', data: newResource });
    } catch (error) {
      console.error('Error in create controller (ResourceType):', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const updatedResource = await resourceTypeService.update(id, req.body);
      return res.status(200).json({ success: true, message: 'Resource type updated successfully.', data: updatedResource });
    } catch (error) {
      console.error(`Error in update controller for ResourceType ID ${req.params.id}:`, error);
      const status = error.message.includes('not found') ? 404 : 400;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await resourceTypeService.delete(id);
      return res.status(200).json({ success: true, message: result.message, data: { id: result.id } });
    } catch (error) {
      console.error(`Error in delete controller for ResourceType ID ${req.params.id}:`, error);
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

      const result = await resourceTypeService.bulkDelete(ids);
      return res.status(200).json({ success: true, message: result.message, data: { deletedCount: result.deletedCount } });
    } catch (error) {
      console.error('Error in bulkDelete controller (ResourceType):', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}

module.exports = new ResourceTypeController();
