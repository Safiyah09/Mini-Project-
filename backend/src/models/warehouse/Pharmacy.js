const mongoose = require('mongoose');
const { schemaOptions, getModel } = require('../commonSchema');

const pharmacySchema = new mongoose.Schema(
  {
    pharmacy_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    name: {
      type: String,
      required: [true, 'Pharmacy name is required'],
      trim: true
    },
    address: {
      type: String,
      required: [true, 'Pharmacy address is required'],
      trim: true
    },
    contact: {
      type: String,
      required: [true, 'Contact details are required'],
      trim: true
    },
    connection_details: {
      db_name: {
        type: String,
        trim: true
      },
      api_endpoint: {
        type: String,
        trim: true
      }
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    ...schemaOptions,
    collection: 'pharmacies'
  }
);

pharmacySchema.index({ name: 1 });

const getPharmacyModel = (conn) => getModel(conn, 'Pharmacy', pharmacySchema);

module.exports = {
  pharmacySchema,
  getPharmacyModel
};
