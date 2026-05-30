const express = require('express');
const router = express.Router();
const userPermissionController = require('../controllers/userPermissionController');

router.get('/', userPermissionController.getAll);
router.get('/:id', userPermissionController.getById);
router.post('/', userPermissionController.create);
router.put('/:id', userPermissionController.update);
router.delete('/:id', userPermissionController.delete);
router.post('/bulk-delete', userPermissionController.bulkDelete);

module.exports = router;
