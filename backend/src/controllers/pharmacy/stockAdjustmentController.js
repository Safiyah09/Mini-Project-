const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { STOCK_STATUS } = require('../../utils/constants');

/**
 * Get all stock adjustments in pharmacy
 * GET /api/pharmacy/adjustments
 */
const getAllAdjustments = async (req, res, next) => {
  try {
    const adjustments = await req.models.StockAdjustment.find()
      .populate('user', 'name username')
      .populate({
        path: 'batch',
        populate: { path: 'medicine', select: 'name dosage formulation' }
      })
      .sort({ adjustment_date: -1 });

    return ApiResponse.success(res, adjustments, 'Stock adjustments retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Create stock adjustment in pharmacy
 * POST /api/pharmacy/adjustments
 */
const createAdjustment = async (req, res, next) => {
  try {
    const { batch, quantity, reason, adjustment_id } = req.body;

    if (!batch || quantity === undefined || !reason) {
      throw ApiError.badRequest('batch, quantity, and reason are required.');
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty === 0) {
      throw ApiError.badRequest('quantity must be a non-zero integer.');
    }

    let batchDoc = null;
    if (batch.match(/^[0-9a-fA-F]{24}$/)) {
      batchDoc = await req.models.Batch.findById(batch);
    }
    if (!batchDoc) {
      batchDoc = await req.models.Batch.findOne({
        $or: [{ batch_id: batch.toUpperCase() }, { batch_number: batch.toUpperCase() }]
      });
    }
    if (!batchDoc) {
      throw ApiError.notFound(`Batch '${batch}' not found.`);
    }

    const stock = await req.models.PharmacyStock.findOne({ batch: batchDoc._id });
    if (!stock) {
      throw ApiError.notFound(`No stock record found for batch '${batchDoc.batch_number}'.`);
    }

    const newQtyOnHand = stock.quantity_on_hand + qty;
    if (newQtyOnHand < 0) {
      throw ApiError.badRequest(
        `Adjustment would result in negative stock. Current: ${stock.quantity_on_hand}, Requested adjustment: ${qty}`
      );
    }

    stock.quantity_on_hand = newQtyOnHand;
    stock.stock_status = newQtyOnHand === 0 ? STOCK_STATUS.OUT_OF_STOCK : STOCK_STATUS.AVAILABLE;
    await stock.save();

    const newAdjId = adjustment_id || `ADJ-PH-${Date.now().toString().slice(-6)}`;

    const adjustment = await req.models.StockAdjustment.create({
      adjustment_id: newAdjId.toUpperCase(),
      batch: batchDoc._id,
      user: req.user._id,
      quantity: qty,
      reason,
      adjustment_date: new Date()
    });

    return ApiResponse.created(res, {
      adjustment,
      stock
    }, 'Stock adjustment recorded successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllAdjustments,
  createAdjustment
};
