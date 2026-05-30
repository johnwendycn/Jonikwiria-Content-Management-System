const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permissionController');

// Bulk delete endpoint (must be defined BEFORE parametric /:id route)
router.post('/bulk-delete', permissionController.bulkDelete);

// CRUD routes
router.get('/', permissionController.getAll);
router.get('/:id', permissionController.getById);
router.post('/', permissionController.create);
router.put('/:id', permissionController.update);
router.delete('/:id', permissionController.delete);

module.exports = router;
