const mongoose = require('mongoose');
const { schemaOptions, getModel } = require('../commonSchema');

const medicineSchema = new mongoose.Schema(
  {
    medicine_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    name: {
      type: String,
      required: [true, 'Medicine name is required'],
      trim: true
    },
    manufacturer: {
      type: String,
      required: [true, 'Manufacturer is required'],
      trim: true,
      index: true
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      index: true
    },
    dosage: {
      type: String,
      required: [true, 'Dosage is required (e.g., 500mg, 10ml)'],
      trim: true
    },
    formulation: {
      type: String,
      required: [true, 'Formulation is required (e.g., Tablet, Capsule, Syrup, Injection)'],
      trim: true
    },
    reorder_level: {
      type: Number,
      default: 20,
      min: [0, 'Reorder level cannot be negative']
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    ...schemaOptions,
    collection: 'medicines'
  }
);

medicineSchema.index({ name: 1, manufacturer: 1, dosage: 1 });

const getMedicineModel = (conn) => getModel(conn, 'Medicine', medicineSchema);

module.exports = {
  medicineSchema,
  getMedicineModel
};
