const express = require('express');
const router = express.Router();
const roleTypeController = require('../controllers/roleTypeController');

// Bulk delete endpoint (must be defined BEFORE parametric /:id route)
router.post('/bulk-delete', roleTypeController.bulkDelete);

// CRUD routes
router.get('/', roleTypeController.getAll);
router.get('/:id', roleTypeController.getById);
router.post('/', roleTypeController.create);
router.put('/:id', roleTypeController.update);
router.delete('/:id', roleTypeController.delete);

module.exports = router;
