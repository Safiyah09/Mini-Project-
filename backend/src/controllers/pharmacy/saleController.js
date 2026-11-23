const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { toDecimal128 } = require('../../models/commonSchema');
const { ALERT_TYPES, STOCK_STATUS, PAYMENT_METHODS, LEDGER_TXN_TYPES } = require('../../utils/constants');
const { allocateFEFO } = require('../../services/common/fefoMinHeap');
const { withTransaction } = require('../../services/common/transactionWrapper');
const { atomicDeductStock } = require('../../services/common/concurrencyService');
const { recordAudit } = require('../../services/common/auditService');
const { validatePositiveQuantity, validateBatchExpiry } = require('../../services/common/sharedValidation');

/**
 * Get all sales transactions
 * GET /api/pharmacy/sales
 */
const getAllSales = async (req, res, next) => {
  try {
    const { customer_id, startDate, endDate, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (customer_id) filter.customer = customer_id;
    if (startDate || endDate) {
      filter.sale_date = {};
      if (startDate) filter.sale_date.$gte = new Date(startDate);
      if (endDate) filter.sale_date.$lte = new Date(endDate);
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const sales = await req.models.Sale.find(filter)
      .populate('customer', 'customer_id name phone email')
      .populate('user', 'name username')
      .sort({ sale_date: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const saleIds = sales.map((s) => s._id);
    const saleItems = await req.models.SaleItem.find({ sale: { $in: saleIds } })
      .populate({
        path: 'batch',
        populate: { path: 'medicine', select: 'name dosage formulation category' }
      });
    const payments = await req.models.Payment.find({ sale: { $in: saleIds } });

    const itemsMap = {};
    saleItems.forEach((itm) => {
      const sId = itm.sale.toString();
      if (!itemsMap[sId]) itemsMap[sId] = [];
      itemsMap[sId].push(itm);
    });

    const paymentsMap = {};
    payments.forEach((p) => {
      const sId = p.sale.toString();
      if (!paymentsMap[sId]) paymentsMap[sId] = [];
      paymentsMap[sId].push(p);
    });

    const populatedSales = sales.map((s) => ({
      ...s.toObject(),
      items: itemsMap[s._id.toString()] || [],
      payments: paymentsMap[s._id.toString()] || []
    }));

    const total = await req.models.Sale.countDocuments(filter);

    return ApiResponse.success(res, {
      sales: populatedSales,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
      }
    }, 'Sales transactions retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Process a point-of-sale customer checkout:
 * Validates stock, prevents negative inventory, checks expiry dates,
 * deducts inventory, triggers low-stock alerts, and records payment.
 * POST /api/pharmacy/sales
 */
const createSale = async (req, res, next) => {
  try {
    const { customer, items, payment_method = 'CASH', notes, sale_id } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw ApiError.badRequest('At least one item is required for a sale.');
    }

    // 1. Resolve Customer (Optional: null for walk-ins)
    let customerDoc = null;
    if (customer) {
      if (customer.match(/^[0-9a-fA-F]{24}$/)) {
        customerDoc = await req.models.Customer.findById(customer);
      }
      if (!customerDoc) {
        customerDoc = await req.models.Customer.findOne({
          $or: [{ customer_id: customer.toUpperCase() }, { phone: customer }]
        });
      }
    }

    const now = new Date();
    let totalSaleAmount = 0;
    const itemsToProcess = [];

    // 2. Pre-validate all items before making any inventory changes
    for (let i = 0; i < items.length; i++) {
      const itm = items[i];
      const qtyToSell = validatePositiveQuantity(itm.quantity, `sale item ${i + 1} quantity`);

      if (itm.batch) {
        // Resolve Batch directly
        let batchDoc = null;
        if (itm.batch.match(/^[0-9a-fA-F]{24}$/)) {
          batchDoc = await req.models.Batch.findById(itm.batch).populate('medicine');
        }
        if (!batchDoc && itm.batch) {
          batchDoc = await req.models.Batch.findOne({
            $or: [{ batch_id: itm.batch.toUpperCase() }, { batch_number: itm.batch.toUpperCase() }]
          }).populate('medicine');
        }
        if (!batchDoc) {
          throw ApiError.notFound(`Batch '${itm.batch}' not found.`);
        }

        // Rule: Prevent dispensing expired medicines (Shared Validation)
        validateBatchExpiry(batchDoc, now);

        // Check Pharmacy Inventory
        const stock = await req.models.PharmacyStock.findOne({ batch: batchDoc._id });
        if (!stock || stock.quantity_on_hand < qtyToSell) {
          const available = stock ? stock.quantity_on_hand : 0;
          throw ApiError.insufficientStock(
            `Insufficient stock for '${batchDoc.medicine ? batchDoc.medicine.name : 'Unknown'}' (Batch ${batchDoc.batch_number}). Requested: ${qtyToSell}, Available: ${available}`,
            [{ batch: batchDoc.batch_number, requested: qtyToSell, available }]
          );
        }

        const unitPrice = parseFloat(itm.unit_price || (batchDoc.medicine ? batchDoc.medicine.unit_price : 20.0) || 20.0);
        const subtotal = qtyToSell * unitPrice;
        totalSaleAmount += subtotal;

        itemsToProcess.push({
          batchDoc,
          stock,
          quantity: qtyToSell,
          unitPrice,
          subtotal
        });
      } else if (itm.medicine) {
        // Medicine specified -> Automatically allocate batches using Min-Heap FEFO
        let medDoc = null;
        if (itm.medicine.match(/^[0-9a-fA-F]{24}$/)) {
          medDoc = await req.models.Medicine.findById(itm.medicine);
        }
        if (!medDoc) {
          medDoc = await req.models.Medicine.findOne({ medicine_id: itm.medicine.toUpperCase() });
        }
        if (!medDoc) {
          throw ApiError.notFound(`Medicine '${itm.medicine}' not found.`);
        }

        // Fetch candidate batches for this medicine
        const candidateBatchesDocs = await req.models.Batch.find({
          medicine: medDoc._id,
          isActive: true
        });

        const batchIds = candidateBatchesDocs.map(b => b._id);
        const stockDocs = await req.models.PharmacyStock.find({
          batch: { $in: batchIds }
        });

        const stockMap = {};
        stockDocs.forEach(s => {
          stockMap[s.batch.toString()] = s;
        });

        const candidateBatches = candidateBatchesDocs.map(b => {
          const s = stockMap[b._id.toString()];
          const avail = s ? Math.max(0, s.quantity_on_hand) : 0;
          return {
            _id: b._id,
            batch_id: b.batch_id,
            batch_number: b.batch_number,
            expiry_date: b.expiry_date,
            manufacturing_date: b.manufacturing_date,
            received_date: b.createdAt || (s ? s.createdAt : null),
            available_quantity: avail,
            _batchDoc: b,
            _stockDoc: s
          };
        });

        // Run pure FEFO allocation algorithm (Min-Heap)
        const plan = allocateFEFO(candidateBatches, qtyToSell, { now });

        if (plan.status !== 'FULL') {
          // If all batches are expired, give an explicit expired rejection
          if (plan.total_unexpired_available === 0 && plan.expired_batches_count > 0) {
            throw ApiError.badRequest(
              `Cannot dispense expired medicine! All available batches for '${medDoc.name}' are expired.`
            );
          }
          throw ApiError.badRequest(
            `Insufficient stock for '${medDoc.name}'. Requested: ${qtyToSell}, Available: ${plan.allocated_quantity}`
          );
        }

        const defaultPrice = parseFloat(itm.unit_price || medDoc.unit_price || 20.0);
        for (const alloc of plan.allocations) {
          const subtotal = alloc.allocated_quantity * defaultPrice;
          totalSaleAmount += subtotal;
          alloc.raw_reference._batchDoc.medicine = medDoc;

          itemsToProcess.push({
            batchDoc: alloc.raw_reference._batchDoc,
            stock: alloc.raw_reference._stockDoc,
            quantity: alloc.allocated_quantity,
            unitPrice: defaultPrice,
            subtotal
          });
        }
      } else {
        throw ApiError.badRequest(`Item ${i + 1} must specify either 'batch' or 'medicine'`);
      }
    }

    const newSaleId = sale_id || `SALE-${Date.now().toString().slice(-6)}`;
    let sale = null;
    let payment = null;
    const createdSaleItems = [];

    // Execute Sale Creation, Inventory Deductions, Ledger & Audit in an ACID Transaction Session
    await withTransaction(req.db, async (session) => {
      // 3. Create Sale Header
      const [saleDoc] = await req.models.Sale.create(
        [
          {
            sale_id: newSaleId.toUpperCase(),
            customer: customerDoc ? customerDoc._id : null,
            user: req.user ? req.user._id : null,
            sale_date: new Date(),
            total_amount: toDecimal128(totalSaleAmount),
            notes
          }
        ],
        { session }
      );
      sale = saleDoc;

      // 4. Create Sale Items and Deduct Inventory Atomically
      for (let i = 0; i < itemsToProcess.length; i++) {
        const itm = itemsToProcess[i];

        const [saleItem] = await req.models.SaleItem.create(
          [
            {
              sale_item_id: `SLI-${sale.sale_id}-${(i + 1).toString().padStart(2, '0')}`,
              sale: sale._id,
              batch: itm.batchDoc._id,
              quantity: itm.quantity,
              unit_price: toDecimal128(itm.unitPrice),
              subtotal: toDecimal128(itm.subtotal)
            }
          ],
          { session }
        );
        createdSaleItems.push(saleItem);

        // Atomic inventory deduction with strict non-negative guarantee under concurrency
        await atomicDeductStock(req.models.PharmacyStock, itm.stock._id, itm.quantity, { session });

        // Record in pharmacy TransactionLedger if model is registered
        if (req.models.TransactionLedger) {
          await req.models.TransactionLedger.create(
            [
              {
                ledger_id: `TXN-POS-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                txn_type: 'DISPATCH',
                medicine_id: itm.batchDoc.medicine._id || itm.batchDoc.medicine,
                batch_id: itm.batchDoc._id,
                quantity_delta: -itm.quantity,
                reference_type: 'SALE',
                reference_id: sale.sale_id,
                user_id: req.user ? req.user._id : null,
                notes: `POS checkout sale ${sale.sale_id}`,
                created_at: new Date()
              }
            ],
            { session }
          );
        }
      }

      // 5. Record Payment
      const [paymentDoc] = await req.models.Payment.create(
        [
          {
            payment_id: `PAY-${sale.sale_id}`,
            sale: sale._id,
            amount: toDecimal128(totalSaleAmount),
            payment_date: new Date(),
            method: payment_method.toUpperCase()
          }
        ],
        { session }
      );
      payment = paymentDoc;

      // 6. Record Audit Log
      await recordAudit(
        req.models,
        {
          user: req.user ? req.user._id : null,
          tableName: 'sales',
          action: 'POS_SALE',
          details: {
            sale_id: sale.sale_id,
            itemsCount: itemsToProcess.length,
            totalAmount: totalSaleAmount,
            paymentMethod: payment_method
          }
        },
        session
      );
    });

    return ApiResponse.created(res, {
      sale: sale.toObject(),
      customer: customerDoc,
      items: createdSaleItems,
      payment
    }, 'Sale completed, inventory updated, and payment confirmed');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllSales,
  createSale
};
