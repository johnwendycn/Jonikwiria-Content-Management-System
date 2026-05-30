const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');

// Bulk delete endpoint (must be defined BEFORE parametric /:id route)
router.post('/bulk-delete', roleController.bulkDelete);

// CRUD routes
router.get('/', roleController.getAll);
router.get('/:id', roleController.getById);
router.post('/', roleController.create);
router.put('/:id', roleController.update);
router.delete('/:id', roleController.delete);

module.exports = router;
