const mongoose = require('mongoose');
const { schemaOptions, getModel, attachPasswordMethods } = require('../commonSchema');

const userSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 50
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false // Exclude from queries by default
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
      index: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    ...schemaOptions,
    collection: 'users'
  }
);



attachPasswordMethods(userSchema);

const getUserModel = (conn) => getModel(conn, 'User', userSchema);

module.exports = {
  userSchema,
  getUserModel
};
