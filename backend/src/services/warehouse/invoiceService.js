const { INVOICE_STATUS } = require('../../utils/constants');

/**
 * Warehouse Invoice Service
 * Handles inter-branch billing and settlements
 */
class WarehouseInvoiceService {
  constructor(models) {
    this.models = models;
  }

  async getOutstandingInvoices() {
    return this.models.Invoice.find({
      status: { $in: [INVOICE_STATUS.UNPAID, INVOICE_STATUS.PARTIALLY_PAID] }
    })
      .populate('pharmacy', 'pharmacy_id name branch_name')
      .sort({ invoice_date: -1 });
  }

  async getPharmacyBillingSummary(pharmacyId) {
    const invoices = await this.models.Invoice.find({ pharmacy: pharmacyId });
    let totalInvoiced = 0;
    let totalOutstanding = 0;

    invoices.forEach(inv => {
      const amt = parseFloat(inv.total_amount ? inv.total_amount.toString() : 0);
      totalInvoiced += amt;
      if (inv.status !== INVOICE_STATUS.PAID && inv.status !== INVOICE_STATUS.CANCELLED) {
        totalOutstanding += amt;
      }
    });

    return { totalInvoiced, totalOutstanding, invoiceCount: invoices.length };
  }
}

module.exports = WarehouseInvoiceService;
