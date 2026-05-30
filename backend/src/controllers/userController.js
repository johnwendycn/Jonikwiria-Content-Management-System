const userService = require('../services/userService');

class UserController {
  async getAll(req, res) {
    try {
      const { page, limit, search, sortBy, sortOrder, showDeleted } = req.query;
      const data = await userService.getAll({
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 10,
        search,
        sortBy,
        sortOrder,
        showDeleted: showDeleted === 'true' // Convert query string to boolean
      });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('Error in getAll controller (User):', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const { includeDeleted } = req.query;
      const user = await userService.getById(id, includeDeleted === 'true');
      return res.status(200).json({ success: true, data: user });
    } catch (error) {
      console.error(`Error in getById controller for User ID ${req.params.id}:`, error);
      const status = error.message.includes('not found') ? 404 : 500;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async create(req, res) {
    try {
      const { 
        email, 
        password_hash, 
        salt, 
        display_name, 
        first_name, 
        last_name, 
        avatar_url,
        status_id, 
        status_reason, 
        locked_until,
        failed_login_attempts,
        last_failed_login_at,
        last_login_at,
        last_login_ip,
        last_password_change,
        mfa_enabled,
        mfa_secret,
        mfa_backup_codes,
        email_verified_at,
        phone_verified_at,
        phone_number,
        current_session_id,
        max_concurrent_sessions,
        allowed_ips,
        allowed_devices,
        department_id,
        cost_center,
        security_clearance,
        geo_restrictions,
        preferences,
        created_by 
      } = req.body;

      if (!email) {
        return res.status(400).json({ success: false, message: 'Email is a required field.' });
      }
      if (!password_hash) {
        return res.status(400).json({ success: false, message: 'Password hash is a required field.' });
      }
      if (!status_id) {
        return res.status(400).json({ success: false, message: 'Status type ID is required.' });
      }

      const newUser = await userService.create({
        email,
        password_hash,
        salt,
        display_name,
        first_name,
        last_name,
        avatar_url,
        status_id,
        status_reason,
        locked_until,
        failed_login_attempts,
        last_failed_login_at,
        last_login_at,
        last_login_ip,
        last_password_change,
        mfa_enabled,
        mfa_secret,
        mfa_backup_codes,
        email_verified_at,
        phone_verified_at,
        phone_number,
        current_session_id,
        max_concurrent_sessions,
        allowed_ips,
        allowed_devices,
        department_id,
        cost_center,
        security_clearance,
        geo_restrictions,
        preferences,
        created_by
      });

      return res.status(201).json({ success: true, message: 'User registered successfully.', data: newUser });
    } catch (error) {
      console.error('Error in create controller (User):', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const updatedUser = await userService.update(id, req.body);
      return res.status(200).json({ success: true, message: 'User updated successfully.', data: updatedUser });
    } catch (error) {
      console.error(`Error in update controller for User ID ${req.params.id}:`, error);
      const status = error.message.includes('not found') ? 404 : 400;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await userService.delete(id);
      return res.status(200).json({ success: true, message: result.message, data: { id: result.id } });
    } catch (error) {
      console.error(`Error in delete controller for User ID ${req.params.id}:`, error);
      const status = error.message.includes('not found') ? 404 : 400;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async restore(req, res) {
    try {
      const { id } = req.params;
      const restoredUser = await userService.restore(id);
      return res.status(200).json({ success: true, message: 'User account restored successfully.', data: restoredUser });
    } catch (error) {
      console.error(`Error in restore controller for User ID ${req.params.id}:`, error);
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

      const result = await userService.bulkDelete(ids);
      return res.status(200).json({ success: true, message: result.message, data: { deletedCount: result.deletedCount } });
    } catch (error) {
      console.error('Error in bulkDelete controller (User):', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}

module.exports = new UserController();
