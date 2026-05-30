const express = require('express');
const router = express.Router();
const auditLogController = require('../controllers/auditLogController');

// ─── READ-ONLY ROUTES ─────────────────────────────────────────────────────────
router.get('/', auditLogController.getAll);
router.get('/stats', auditLogController.getStats);
router.get('/:id', auditLogController.getById);

// ─── IMMUTABILITY ENFORCEMENT ─────────────────────────────────────────────────
// All mutation routes explicitly blocked and return 405 Method Not Allowed.
// This applies to ALL users — including Super Admins.

router.post('/', auditLogController.blockMutation);
router.put('/:id', auditLogController.blockMutation);
router.patch('/:id', auditLogController.blockMutation);
router.delete('/:id', auditLogController.blockMutation);
router.delete('/', auditLogController.blockMutation);

module.exports = router;
