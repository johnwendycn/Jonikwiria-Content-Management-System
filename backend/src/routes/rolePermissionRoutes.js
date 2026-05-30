const express = require('express');
const router = express.Router();
const rolePermissionController = require('../controllers/rolePermissionController');

// Bulk delete endpoint (must be defined BEFORE parametric /:id routes)
router.post('/bulk-delete', rolePermissionController.bulkDelete);

// CRUD routes
router.get('/', rolePermissionController.getAll);
router.get('/:id', rolePermissionController.getById);
router.post('/', rolePermissionController.create);
router.put('/:id', rolePermissionController.update);
router.delete('/:id', rolePermissionController.delete);

module.exports = router;
