const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Standard schema options across all models
 */
const schemaOptions = {
  timestamps: true,
  toJSON: {
    getters: true,
    virtuals: true,
    transform: function (doc, ret) {
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    getters: true,
    virtuals: true,
    transform: function (doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
};

/**
 * Helper to register or retrieve a model on a given connection.
 * Essential for multi-database architecture (warehouse vs dynamic pharmacy connections).
 *
 * @param {mongoose.Connection} conn
 * @param {string} modelName
 * @param {mongoose.Schema} schema
 * @returns {mongoose.Model}
 */
function getModel(conn, modelName, schema) {
  if (!conn) {
    throw new Error(`Database connection must be provided to get model '${modelName}'`);
  }
  return conn.models[modelName] || conn.model(modelName, schema);
}

/**
 * Reusable schema field definition for monetary values.
 * Stores values as MongoDB Decimal128 with numeric getters for API serialization.
 */
function createCurrencyField(options = {}) {
  const isRequired = options.required !== false;
  const minVal = options.min !== undefined ? options.min : 0;

  return {
    type: mongoose.Schema.Types.Decimal128,
    required: isRequired ? [true, 'Monetary amount is required'] : false,
    default: options.default !== undefined ? () => mongoose.Types.Decimal128.fromString(Number(options.default).toFixed(2)) : undefined,
    set: (val) => {
      if (val === null || val === undefined) return val;
      if (val instanceof mongoose.Types.Decimal128) return val;
      const num = Number(val);
      if (isNaN(num)) return val;
      return mongoose.Types.Decimal128.fromString(num.toFixed(2));
    },
    get: (val) => {
      if (val === null || val === undefined) return val;
      return parseFloat(val.toString());
    },
    validate: {
      validator: function (val) {
        if (val === null || val === undefined) return !isRequired;
        const num = parseFloat(val.toString());
        return !isNaN(num) && num >= minVal;
      },
      message: (props) => `Amount must be a valid number >= ${minVal} (got ${props.value})`
    }
  };
}

/**
 * Converts a JS number or string to Decimal128
 */
function toDecimal128(val) {
  if (val instanceof mongoose.Types.Decimal128) return val;
  const num = Number(val);
  return mongoose.Types.Decimal128.fromString(num.toFixed(2));
}

/**
 * Attaches bcrypt pre-save password hashing and comparePassword method to user schemas
 */
function attachPasswordMethods(userSchema) {
  userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    try {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
      next();
    } catch (err) {
      next(err);
    }
  });

  userSchema.methods.comparePassword = async function (enteredPassword) {
    return bcrypt.compare(enteredPassword, this.password);
  };
}

module.exports = {
  schemaOptions,
  getModel,
  createCurrencyField,
  toDecimal128,
  attachPasswordMethods
};
