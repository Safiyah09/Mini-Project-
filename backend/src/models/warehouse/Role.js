const mongoose = require('mongoose');
const { schemaOptions, getModel } = require('../commonSchema');

const roleSchema = new mongoose.Schema(
  {
    role_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    role_name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    }
  },
  {
    ...schemaOptions,
    collection: 'roles'
  }
);



const getRoleModel = (conn) => getModel(conn, 'Role', roleSchema);

module.exports = {
  roleSchema,
  getRoleModel
};
