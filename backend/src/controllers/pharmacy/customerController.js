const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');

/**
 * Get all pharmacy customers with search and pagination
 * GET /api/pharmacy/customers
 */
const getAllCustomers = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { customer_id: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const customers = await req.models.Customer.find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await req.models.Customer.countDocuments(filter);

    return ApiResponse.success(res, {
      customers,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
      }
    }, 'Customers retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Get customer by ID or phone
 * GET /api/pharmacy/customers/:id
 */
const getCustomerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let customer = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      customer = await req.models.Customer.findById(id);
    }
    if (!customer) {
      customer = await req.models.Customer.findOne({
        $or: [{ customer_id: id.toUpperCase() }, { phone: id }]
      });
    }

    if (!customer) {
      throw ApiError.notFound(`Customer not found with identifier: ${id}`);
    }

    return ApiResponse.success(res, customer, 'Customer retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new customer
 * POST /api/pharmacy/customers
 */
const createCustomer = async (req, res, next) => {
  try {
    const { customer_id, name, phone, email, address, date_of_birth } = req.body;

    if (!name || !phone) {
      throw ApiError.badRequest('name and phone are required fields.');
    }

    const newId = customer_id || `CUST-${Date.now().toString().slice(-6)}`;

    const customer = await req.models.Customer.create({
      customer_id: newId.toUpperCase(),
      name,
      phone,
      email,
      address,
      date_of_birth: date_of_birth ? new Date(date_of_birth) : undefined
    });

    return ApiResponse.created(res, customer, 'Customer created successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Update an existing customer
 * PUT /api/pharmacy/customers/:id
 */
const updateCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const customer = await req.models.Customer.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    });

    if (!customer) {
      throw ApiError.notFound(`Customer not found with id: ${id}`);
    }

    return ApiResponse.success(res, customer, 'Customer updated successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer
};
