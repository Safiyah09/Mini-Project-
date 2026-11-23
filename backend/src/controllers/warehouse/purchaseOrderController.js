const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { toDecimal128 } = require('../../models/commonSchema');
const { PURCHASE_ORDER_STATUS, AUDIT_ACTIONS } = require('../../utils/constants');

/**
 * Get all Purchase Orders with line items
 * GET /api/warehouse/purchase-orders
 */
const getAllPurchaseOrders = async (req, res, next) => {
  try {
    const { status, supplier_id, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (status) filter.status = status.toUpperCase();
    if (supplier_id) filter.supplier = supplier_id;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const purchaseOrders = await req.models.PurchaseOrder.find(filter)
      .populate('supplier', 'supplier_id name contact')
      .sort({ order_date: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    // Fetch items for each purchase order
    const poIds = purchaseOrders.map((po) => po._id);
    const items = await req.models.PurchaseOrderItem.find({ purchase_order: { $in: poIds } })
      .populate('medicine', 'medicine_id name dosage formulation');

    const itemsMap = {};
    items.forEach((item) => {
      const poIdStr = item.purchase_order.toString();
      if (!itemsMap[poIdStr]) itemsMap[poIdStr] = [];
      itemsMap[poIdStr].push(item);
    });

    const populatedPOs = purchaseOrders.map((po) => ({
      ...po.toObject(),
      items: itemsMap[po._id.toString()] || []
    }));

    const total = await req.models.PurchaseOrder.countDocuments(filter);

    return ApiResponse.success(res, {
      purchaseOrders: populatedPOs,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
      }
    }, 'Purchase orders retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Get single Purchase Order by ID with items
 * GET /api/warehouse/purchase-orders/:id
 */
const getPurchaseOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let po = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      po = await req.models.PurchaseOrder.findById(id).populate('supplier', 'supplier_id name address contact');
    }
    if (!po) {
      po = await req.models.PurchaseOrder.findOne({ po_id: id.toUpperCase() }).populate('supplier', 'supplier_id name address contact');
    }

    if (!po) {
      throw ApiError.notFound(`Purchase order not found with identifier: ${id}`);
    }

    const items = await req.models.PurchaseOrderItem.find({ purchase_order: po._id })
      .populate('medicine', 'medicine_id name dosage formulation manufacturer category');

    return ApiResponse.success(res, {
      ...po.toObject(),
      items
    }, 'Purchase order retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new Purchase Order with items
 * POST /api/warehouse/purchase-orders
 */
const createPurchaseOrder = async (req, res, next) => {
  try {
    const { supplier, po_id, items, notes } = req.body;

    if (!supplier) {
      throw ApiError.badRequest('Supplier ID or ObjectId is required.');
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw ApiError.badRequest('At least one item is required to create a purchase order.');
    }

    // Resolve supplier
    let supplierDoc = null;
    if (supplier.match(/^[0-9a-fA-F]{24}$/)) {
      supplierDoc = await req.models.Supplier.findById(supplier);
    }
    if (!supplierDoc) {
      supplierDoc = await req.models.Supplier.findOne({ supplier_id: supplier.toUpperCase() });
    }
    if (!supplierDoc) {
      throw ApiError.notFound(`Supplier '${supplier}' not found.`);
    }

    const newPoId = po_id || `PO-${Date.now().toString().slice(-6)}`;

    // Create Purchase Order header
    const po = await req.models.PurchaseOrder.create({
      po_id: newPoId.toUpperCase(),
      supplier: supplierDoc._id,
      status: PURCHASE_ORDER_STATUS.ORDERED,
      notes
    });

    // Create Line Items
    const createdItems = [];
    for (let i = 0; i < items.length; i++) {
      const itm = items[i];
      let medDoc = null;

      if (itm.medicine && itm.medicine.match(/^[0-9a-fA-F]{24}$/)) {
        medDoc = await req.models.Medicine.findById(itm.medicine);
      }
      if (!medDoc && itm.medicine) {
        medDoc = await req.models.Medicine.findOne({ medicine_id: itm.medicine.toUpperCase() });
      }

      if (!medDoc) {
        throw ApiError.notFound(`Medicine '${itm.medicine}' in items[${i}] not found.`);
      }

      const poItem = await req.models.PurchaseOrderItem.create({
        po_item_id: `POI-${po.po_id}-${(i + 1).toString().padStart(2, '0')}`,
        purchase_order: po._id,
        medicine: medDoc._id,
        quantity_ordered: parseInt(itm.quantity_ordered, 10),
        unit_cost: toDecimal128(itm.unit_cost)
      });
      createdItems.push(poItem);
    }

    // Audit Log
    if (req.user) {
      await req.models.AuditLog.create({
        log_id: `LOG-${Date.now()}`,
        user: req.user._id,
        table_name: 'purchase_orders',
        action: AUDIT_ACTIONS.CREATE,
        details: { po_id: po.po_id, supplier: supplierDoc.name, itemsCount: items.length }
      });
    }

    return ApiResponse.created(res, {
      ...po.toObject(),
      items: createdItems
    }, 'Purchase order created successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder
};
