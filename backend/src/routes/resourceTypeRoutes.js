const express = require('express');
const router = express.Router();
const resourceTypeController = require('../controllers/resourceTypeController');

// Bulk delete endpoint (must be defined BEFORE parametric /:id route)
router.post('/bulk-delete', resourceTypeController.bulkDelete);

// CRUD routes
router.get('/', resourceTypeController.getAll);
router.get('/:id', resourceTypeController.getById);
router.post('/', resourceTypeController.create);
router.put('/:id', resourceTypeController.update);
router.delete('/:id', resourceTypeController.delete);

module.exports = router;
