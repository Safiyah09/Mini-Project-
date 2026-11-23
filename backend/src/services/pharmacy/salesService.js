/**
 * Pharmacy Sales Service
 * Manages point-of-sale calculations and daily revenue summaries
 */
class PharmacySalesService {
  constructor(models) {
    this.models = models;
  }

  async getDailySalesReport(date = new Date()) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const sales = await this.models.Sale.find({
      sale_date: { $gte: start, $lte: end }
    });

    let totalRevenue = 0;
    let totalDiscount = 0;

    sales.forEach(s => {
      totalRevenue += parseFloat(s.total_amount ? s.total_amount.toString() : 0);
      totalDiscount += parseFloat(s.discount_amount ? s.discount_amount.toString() : 0);
    });

    return {
      date: start.toISOString().split('T')[0],
      transactionCount: sales.length,
      totalRevenue,
      totalDiscount
    };
  }

  async getTopSellingMedicines(limit = 10) {
    const saleItems = await this.models.SaleItem.aggregate([
      {
        $group: {
          _id: '$batch',
          totalQuantity: { $sum: '$quantity' },
          totalRevenue: { $sum: { $toDouble: '$total_price' } }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: limit }
    ]);

    return saleItems;
  }
}

module.exports = PharmacySalesService;
