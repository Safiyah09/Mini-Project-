const express = require('express');
const router = express.Router();
const ApiResponse = require('../../utils/ApiResponse');
const { warehouseContext, authenticateWarehouse } = require('../../middleware/authMiddleware');

router.use(warehouseContext);
router.use(authenticateWarehouse);

/**
 * Get all Receipt Discrepancies reported by branch pharmacies
 * GET /api/warehouse/discrepancies
 */
router.get('/', async (req, res, next) => {
  try {
    const { transfer_id, pharmacy_id, discrepancy_type, resolved } = req.query;
    const filter = {};

    if (transfer_id) filter.transfer_id = transfer_id.toUpperCase();
    if (pharmacy_id) filter.pharmacy_id = pharmacy_id;
    if (discrepancy_type) filter.discrepancy_type = discrepancy_type.toUpperCase();
    if (resolved !== undefined) filter.resolved = resolved === 'true';

    const discrepancies = await req.models.ReceiptDiscrepancy.find(filter)
      .populate('pharmacy', 'pharmacy_id name address contact')
      .sort({ created_at: -1 });

    return ApiResponse.success(res, {
      count: discrepancies.length,
      discrepancies
    }, 'Receipt discrepancies retrieved successfully');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
