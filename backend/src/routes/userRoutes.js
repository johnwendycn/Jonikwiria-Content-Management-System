const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Bulk delete endpoint (must be defined BEFORE parametric /:id routes)
router.post('/bulk-delete', userController.bulkDelete);

// Restore endpoint
router.post('/:id/restore', userController.restore);

// CRUD routes
router.get('/', userController.getAll);
router.get('/:id', userController.getById);
router.post('/', userController.create);
router.put('/:id', userController.update);
router.delete('/:id', userController.delete);

module.exports = router;
