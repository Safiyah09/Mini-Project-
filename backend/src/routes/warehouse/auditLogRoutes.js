const express = require('express');
const router = express.Router();
const auditLogController = require('../../controllers/warehouse/auditLogController');
const { authenticateWarehouse } = require('../../middleware/authMiddleware');
const { authorizeRoles } = require('../../middleware/roleMiddleware');

router.use(authenticateWarehouse);

router.get('/', authorizeRoles('WAREHOUSE_ADMIN', 'AUDITOR'), auditLogController.getAllAuditLogs);
router.get('/:id', authorizeRoles('WAREHOUSE_ADMIN', 'AUDITOR'), auditLogController.getAuditLogById);

module.exports = router;
