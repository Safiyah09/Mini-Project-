const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file inside backend/ or root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,
  MONGODB_URI: process.env.MONGODB_URI,
  WAREHOUSE_DB_NAME: process.env.WAREHOUSE_DB_NAME || 'warehouse',
  DEFAULT_PHARMACY_DB_NAME: process.env.DEFAULT_PHARMACY_DB_NAME || 'pharmacy',
  PHARMACY_DB_PREFIX: process.env.PHARMACY_DB_PREFIX || 'pharmacy_',
  JWT_SECRET: process.env.JWT_SECRET || 'pharmaceutical_secret_jwt_key_default',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLIENT_URL: process.env.CLIENT_URL || '*'
};

// Validate critical environment configurations
if (!env.MONGODB_URI) {
  console.error('FATAL ERROR: MONGODB_URI environment variable is missing.');
  process.exit(1);
}

module.exports = env;
