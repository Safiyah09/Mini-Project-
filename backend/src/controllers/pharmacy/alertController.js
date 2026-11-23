const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');

/**
 * Get all pharmacy alerts
 * GET /api/pharmacy/alerts
 */
const getAlerts = async (req, res, next) => {
  try {
    const { resolved = 'false', alert_type } = req.query;
    const filter = {};

    if (resolved !== 'all') {
      filter.resolved = resolved === 'true';
    }
    if (alert_type) {
      filter.alert_type = alert_type.toUpperCase();
    }

    const alerts = await req.models.Alert.find(filter)
      .populate('medicine', 'medicine_id name dosage formulation category reorder_level')
      .sort({ created_at: -1 });

    return ApiResponse.success(res, alerts, 'Alerts retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Mark alert as resolved
 * PUT /api/pharmacy/alerts/:id/resolve
 */
const resolveAlert = async (req, res, next) => {
  try {
    const { id } = req.params;
    const alert = await req.models.Alert.findByIdAndUpdate(id, { resolved: true }, { new: true })
      .populate('medicine', 'medicine_id name');

    if (!alert) {
      throw ApiError.notFound(`Alert not found with id: ${id}`);
    }

    return ApiResponse.success(res, alert, 'Alert marked as resolved');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAlerts,
  resolveAlert
};
