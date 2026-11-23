const express = require('express');
const router = express.Router();
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { warehouseContext } = require('../../middleware/authMiddleware');
const { requireServiceAuth } = require('../../middleware/serviceAuthMiddleware');
const { lookupWarehouseTransferManifest } = require('../../services/interServiceBridge');

router.use(warehouseContext);
router.use(requireServiceAuth);

/**
 * 1. Service: Receive transmitted supply request from Pharmacy
 * POST /api/warehouse/service/supply-requests
 */
router.post('/supply-requests', async (req, res, next) => {
  try {
    const { pharmacy_id, request_id, items, notes } = req.body;

    if (!pharmacy_id || !request_id || !items || !Array.isArray(items)) {
      throw ApiError.badRequest('pharmacy_id, request_id, and items array are required.');
    }

    let whPharmacy = await req.models.Pharmacy.findOne({
      $or: [
        { pharmacy_id: pharmacy_id.toUpperCase() },
        { name: new RegExp(pharmacy_id, 'i') }
      ]
    });

    if (!whPharmacy) {
      whPharmacy = await req.models.Pharmacy.findOne();
    }

    if (!whPharmacy) {
      throw ApiError.internal('No registered pharmacy found in warehouse database.');
    }

    let whReq = await req.models.SupplyRequest.findOne({ request_id: request_id.toUpperCase() });
    if (!whReq) {
      whReq = await req.models.SupplyRequest.create({
        request_id: request_id.toUpperCase(),
        pharmacy: whPharmacy._id,
        request_date: new Date(),
        status: 'PENDING',
        notes: notes || 'Transmitted via secure service bridge'
      });

      for (let i = 0; i < items.length; i++) {
        const itm = items[i];
        let medDoc = null;
        if (itm.medicine_id) {
          medDoc = await req.models.Medicine.findOne({ medicine_id: itm.medicine_id.toUpperCase() });
        }
        if (!medDoc && itm.medicine_name) {
          medDoc = await req.models.Medicine.findOne({ name: itm.medicine_name });
        }
        if (!medDoc) {
          medDoc = await req.models.Medicine.findOne();
        }

        if (medDoc) {
          await req.models.RequestItem.create({
            request_item_id: `RQI-${whReq.request_id}-${(i + 1).toString().padStart(2, '0')}`,
            supply_request: whReq._id,
            medicine: medDoc._id,
            quantity_requested: itm.quantity_requested || 1,
            quantity_fulfilled: 0,
            quantity_pending: itm.quantity_requested || 1,
            is_backordered: false
          });
        }
      }
    }

    return ApiResponse.created(res, whReq, 'Supply request successfully received by Central Warehouse Service');
  } catch (err) {
    next(err);
  }
});

/**
 * 2. Service: Lookup Warehouse Transfer Manifest
 * GET /api/warehouse/service/manifest/:transferId
 */
router.get('/manifest/:transferId', async (req, res, next) => {
  try {
    const { transferId } = req.params;
    const manifest = await lookupWarehouseTransferManifest(transferId);
    return ApiResponse.success(res, manifest, 'Transfer manifest retrieved via service bridge');
  } catch (err) {
    next(err);
  }
});

/**
 * 3. Service: Record Discrepancy from Pharmacy Receipt
 * POST /api/warehouse/service/discrepancies
 */
router.post('/discrepancies', async (req, res, next) => {
  try {
    const { discrepancies, pharmacy_id } = req.body;
    if (!discrepancies || !Array.isArray(discrepancies)) {
      throw ApiError.badRequest('discrepancies array is required.');
    }

    const payload = discrepancies.map((d) => ({
      ...d,
      pharmacy_id: pharmacy_id || d.pharmacy_id || 'pharmacy'
    }));

    const records = await req.models.ReceiptDiscrepancy.insertMany(payload);
    return ApiResponse.created(res, records, 'Discrepancies recorded in Central Warehouse');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
