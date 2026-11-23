const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { INVOICE_STATUS } = require('../../utils/constants');

/**
 * List all invoices
 * GET /api/warehouse/invoices
 */
const getAllInvoices = async (req, res, next) => {
  try {
    const { status, pharmacy, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (status) filter.status = status.toUpperCase();
    if (pharmacy) filter.pharmacy = pharmacy;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const invoices = await req.models.Invoice.find(filter)
      .populate('pharmacy', 'pharmacy_id name branch_name city')
      .populate('stock_transfer', 'transfer_id transfer_date status')
      .sort({ invoice_date: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await req.models.Invoice.countDocuments(filter);

    return ApiResponse.success(res, {
      invoices,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
      }
    }, 'Invoices retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Get invoice by ID or invoice_id
 * GET /api/warehouse/invoices/:id
 */
const getInvoiceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let invoice = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      invoice = await req.models.Invoice.findById(id);
    }
    if (!invoice) {
      invoice = await req.models.Invoice.findOne({ invoice_id: id.toUpperCase() });
    }

    if (!invoice) {
      throw ApiError.notFound(`Invoice not found with identifier: ${id}`);
    }

    await invoice.populate([
      { path: 'pharmacy', select: 'pharmacy_id name branch_name address contact' },
      { path: 'stock_transfer', select: 'transfer_id transfer_date status shipping_reference' }
    ]);

    // Retrieve transfer items
    const transferItems = await req.models.TransferItem.find({ stock_transfer: invoice.stock_transfer._id })
      .populate({
        path: 'batch',
        populate: { path: 'medicine', select: 'medicine_id name dosage formulation' }
      });

    // Retrieve payments
    const payments = await req.models.Payment.find({ invoice: invoice._id }).sort({ payment_date: -1 });

    return ApiResponse.success(res, {
      invoice,
      transferItems,
      payments
    }, 'Invoice details retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Update invoice status
 * PUT /api/warehouse/invoices/:id/status
 */
const updateInvoiceStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !Object.values(INVOICE_STATUS).includes(status.toUpperCase())) {
      throw ApiError.badRequest(`Invalid status. Allowed values: ${Object.values(INVOICE_STATUS).join(', ')}`);
    }

    const invoice = await req.models.Invoice.findById(id);
    if (!invoice) {
      throw ApiError.notFound(`Invoice not found with id: ${id}`);
    }

    invoice.status = status.toUpperCase();
    await invoice.save();

    return ApiResponse.success(res, invoice, `Invoice status updated to ${invoice.status}`);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllInvoices,
  getInvoiceById,
  updateInvoiceStatus
};
