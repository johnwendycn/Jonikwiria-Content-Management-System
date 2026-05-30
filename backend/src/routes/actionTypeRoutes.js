const express = require('express');
const router = express.Router();
const actionTypeController = require('../controllers/actionTypeController');

// Bulk delete endpoint (must be defined BEFORE parametric /:id route)
router.post('/bulk-delete', actionTypeController.bulkDelete);

// CRUD routes
router.get('/', actionTypeController.getAll);
router.get('/:id', actionTypeController.getById);
router.post('/', actionTypeController.create);
router.put('/:id', actionTypeController.update);
router.delete('/:id', actionTypeController.delete);

module.exports = router;
