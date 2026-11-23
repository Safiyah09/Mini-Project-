const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');

/**
 * List audit logs with pagination and filters
 * GET /api/warehouse/audit-logs
 */
const getAllAuditLogs = async (req, res, next) => {
  try {
    const { table_name, action, start_date, end_date, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (table_name) filter.table_name = table_name.toLowerCase();
    if (action) filter.action = action.toUpperCase();

    if (start_date || end_date) {
      filter.logged_at = {};
      if (start_date) filter.logged_at.$gte = new Date(start_date);
      if (end_date) filter.logged_at.$lte = new Date(end_date);
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const logs = await req.models.AuditLog.find(filter)
      .populate('user', 'username name email')
      .sort({ logged_at: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await req.models.AuditLog.countDocuments(filter);

    return ApiResponse.success(res, {
      logs,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
      }
    }, 'Audit logs retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Get audit log details by ID
 * GET /api/warehouse/audit-logs/:id
 */
const getAuditLogById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let log = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      log = await req.models.AuditLog.findById(id).populate('user', 'username name email');
    }
    if (!log) {
      log = await req.models.AuditLog.findOne({ log_id: id }).populate('user', 'username name email');
    }

    if (!log) {
      throw ApiError.notFound(`Audit log not found with identifier: ${id}`);
    }

    return ApiResponse.success(res, log, 'Audit log retrieved successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllAuditLogs,
  getAuditLogById
};
