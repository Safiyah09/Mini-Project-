const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { toDecimal128 } = require('../../models/commonSchema');
const { PAYMENT_METHODS, INVOICE_STATUS } = require('../../utils/constants');

/**
 * Record a payment against an invoice
 * POST /api/warehouse/payments
 */
const recordPayment = async (req, res, next) => {
  try {
    const { invoice_id, amount, method, reference_number, payment_id } = req.body;

    if (!invoice_id || !amount || !method) {
      throw ApiError.badRequest('invoice_id, amount, and method are required.');
    }

    const payAmount = parseFloat(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      throw ApiError.badRequest('amount must be a positive number.');
    }

    if (!Object.values(PAYMENT_METHODS).includes(method.toUpperCase())) {
      throw ApiError.badRequest(`Invalid method. Allowed: ${Object.values(PAYMENT_METHODS).join(', ')}`);
    }

    // Resolve Invoice
    let invoice = null;
    if (invoice_id.match(/^[0-9a-fA-F]{24}$/)) {
      invoice = await req.models.Invoice.findById(invoice_id);
    }
    if (!invoice) {
      invoice = await req.models.Invoice.findOne({ invoice_id: invoice_id.toUpperCase() });
    }

    if (!invoice) {
      throw ApiError.notFound(`Invoice not found: ${invoice_id}`);
    }

    const newPaymentId = payment_id || `PAY-WH-${Date.now().toString().slice(-6)}`;

    const payment = await req.models.Payment.create({
      payment_id: newPaymentId.toUpperCase(),
      invoice: invoice._id,
      amount: toDecimal128(payAmount),
      payment_date: new Date(),
      method: method.toUpperCase(),
      reference_number: reference_number || undefined
    });

    // Check total payments against invoice amount
    const allPayments = await req.models.Payment.find({ invoice: invoice._id });
    const totalPaid = allPayments.reduce((sum, p) => sum + parseFloat(p.amount ? p.amount.toString() : 0), 0);
    const invoiceTotal = parseFloat(invoice.total_amount ? invoice.total_amount.toString() : 0);

    if (totalPaid >= invoiceTotal) {
      invoice.status = INVOICE_STATUS.PAID;
    } else if (totalPaid > 0) {
      invoice.status = INVOICE_STATUS.PARTIALLY_PAID;
    }
    await invoice.save();

    return ApiResponse.created(res, {
      payment,
      invoiceSummary: {
        invoice_id: invoice.invoice_id,
        total_amount: invoiceTotal,
        total_paid: totalPaid,
        outstanding: Math.max(0, invoiceTotal - totalPaid),
        status: invoice.status
      }
    }, 'Payment recorded successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * List all payments
 * GET /api/warehouse/payments
 */
const getAllPayments = async (req, res, next) => {
  try {
    const { invoice_id, method, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (method) filter.method = method.toUpperCase();

    if (invoice_id) {
      let invDoc = null;
      if (invoice_id.match(/^[0-9a-fA-F]{24}$/)) {
        invDoc = await req.models.Invoice.findById(invoice_id);
      }
      if (!invDoc) {
        invDoc = await req.models.Invoice.findOne({ invoice_id: invoice_id.toUpperCase() });
      }
      if (invDoc) {
        filter.invoice = invDoc._id;
      }
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const payments = await req.models.Payment.find(filter)
      .populate({
        path: 'invoice',
        select: 'invoice_id total_amount status pharmacy',
        populate: { path: 'pharmacy', select: 'name branch_name' }
      })
      .sort({ payment_date: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await req.models.Payment.countDocuments(filter);

    return ApiResponse.success(res, {
      payments,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
      }
    }, 'Payments retrieved successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  recordPayment,
  getAllPayments
};
