const ApiResponse = require('../../utils/ApiResponse');

/**
 * Get all pharmacy stocks with populated batch and medicine
 * GET /api/pharmacy/stocks
 */
const getPharmacyInventory = async (req, res, next) => {
  try {
    const { search, status, medicine_id, sort = 'quantity_on_hand', order = 'asc', page = 1, limit = 50 } = req.query;
    const filter = {};

    if (status) {
      filter.stock_status = status.toUpperCase();
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    let stocks = await req.models.PharmacyStock.find(filter)
      .populate({
        path: 'batch',
        populate: { path: 'medicine', select: 'medicine_id name dosage formulation category manufacturer reorder_level' }
      })
      .skip(skip)
      .limit(parseInt(limit, 10));

    // In-memory text matching if search provided
    if (search) {
      const q = search.toLowerCase();
      stocks = stocks.filter((s) => {
        const medName = s.batch?.medicine?.name?.toLowerCase() || '';
        const medId = s.batch?.medicine?.medicine_id?.toLowerCase() || '';
        const batchNum = s.batch?.batch_number?.toLowerCase() || '';
        const cat = s.batch?.medicine?.category?.toLowerCase() || '';
        return medName.includes(q) || medId.includes(q) || batchNum.includes(q) || cat.includes(q);
      });
    }

    if (medicine_id) {
      stocks = stocks.filter((s) => s.batch?.medicine?._id?.toString() === medicine_id || s.batch?.medicine?.medicine_id === medicine_id.toUpperCase());
    }

    // Sort
    stocks.sort((a, b) => {
      let valA, valB;
      if (sort === 'expiry_date') {
        valA = new Date(a.batch?.expiry_date || 0);
        valB = new Date(b.batch?.expiry_date || 0);
      } else if (sort === 'name') {
        valA = a.batch?.medicine?.name || '';
        valB = b.batch?.medicine?.name || '';
      } else {
        valA = a.quantity_on_hand || 0;
        valB = b.quantity_on_hand || 0;
      }
      if (order === 'desc') return valA < valB ? 1 : -1;
      return valA > valB ? 1 : -1;
    });

    const total = await req.models.PharmacyStock.countDocuments(filter);

    return ApiResponse.success(res, {
      stocks,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: search ? stocks.length : total,
        pages: Math.ceil((search ? stocks.length : total) / limit)
      }
    }, 'Pharmacy inventory retrieved successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPharmacyInventory
};
