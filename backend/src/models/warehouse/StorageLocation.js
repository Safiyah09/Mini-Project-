const mongoose = require('mongoose');
const { schemaOptions, getModel } = require('../commonSchema');

const storageLocationSchema = new mongoose.Schema(
  {
    location_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    zone: {
      type: String,
      required: [true, 'Warehouse zone is required (e.g., Zone A, Zone B)'],
      trim: true
    },
    rack_bin: {
      type: String,
      required: [true, 'Rack and bin identifier is required (e.g., Rack 4 / Bin 12)'],
      trim: true
    },
    cold_storage: {
      type: Boolean,
      default: false
    },
    description: {
      type: String,
      trim: true
    }
  },
  {
    ...schemaOptions,
    collection: 'storage_locations'
  }
);

storageLocationSchema.index({ zone: 1, rack_bin: 1 });

const getStorageLocationModel = (conn) => getModel(conn, 'StorageLocation', storageLocationSchema);

module.exports = {
  storageLocationSchema,
  getStorageLocationModel
};
