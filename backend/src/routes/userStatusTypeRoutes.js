const express = require('express');
const router = express.Router();
const userStatusTypeController = require('../controllers/userStatusTypeController');

// Bulk delete endpoint (must be defined BEFORE parametric /:id route)
router.post('/bulk-delete', userStatusTypeController.bulkDelete);

// CRUD routes
router.get('/', userStatusTypeController.getAll);
router.get('/:id', userStatusTypeController.getById);
router.post('/', userStatusTypeController.create);
router.put('/:id', userStatusTypeController.update);
router.delete('/:id', userStatusTypeController.delete);

module.exports = router;
