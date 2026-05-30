const express = require('express');
const router = express.Router();
const userRoleController = require('../controllers/userRoleController');

// Bulk delete endpoint (must be defined BEFORE parametric /:id routes)
router.post('/bulk-delete', userRoleController.bulkDelete);

// CRUD routes
router.get('/', userRoleController.getAll);
router.get('/:id', userRoleController.getById);
router.post('/', userRoleController.create);
router.put('/:id', userRoleController.update);
router.delete('/:id', userRoleController.delete);

module.exports = router;
