/**
 * ============================================================================
 * ENGINE E4: REUSABLE MONGODB TRANSACTION WRAPPER
 * ============================================================================
 * Provides robust ACID transaction management with replica set session handling,
 * automatic rollback on failure, and optional transient error retries.
 * ============================================================================
 */

/**
 * Executes a database operation within an ACID transaction session.
 * 
 * @param {import('mongoose').Connection} connection - Active Mongoose connection
 * @param {Function} operationFn - Async function (session) => Promise<any>
 * @param {Object} [options]
 * @param {number} [options.maxRetries=2] - Number of transient retries on write conflict
 * @param {Object} [options.transactionOptions] - Custom transaction settings
 * @returns {Promise<any>} Result returned by operationFn
 */
async function withTransaction(connectionOrReq, operationFn, options = {}) {
  const connection = connectionOrReq && typeof connectionOrReq.startSession === 'function'
    ? connectionOrReq
    : (connectionOrReq && connectionOrReq.db && typeof connectionOrReq.db.startSession === 'function'
      ? connectionOrReq.db
      : (connectionOrReq && connectionOrReq.pharmacyConn && typeof connectionOrReq.pharmacyConn.startSession === 'function'
        ? connectionOrReq.pharmacyConn
        : (connectionOrReq && connectionOrReq.warehouseConn && typeof connectionOrReq.warehouseConn.startSession === 'function'
          ? connectionOrReq.warehouseConn
          : null)));

  if (!connection || typeof connection.startSession !== 'function') {
    throw new TypeError('Valid Mongoose connection required for transaction wrapper');
  }

  const maxRetries = options.maxRetries !== undefined ? options.maxRetries : 8;
  const transactionOptions = options.transactionOptions || {
    readConcern: { level: 'snapshot' },
    writeConcern: { w: 'majority' },
    maxCommitTimeMS: 10000
  };

  let attempt = 0;

  while (true) {
    attempt++;
    const session = await connection.startSession();

    try {
      session.startTransaction(transactionOptions);

      const result = await operationFn(session);

      if (session.inTransaction()) {
        await session.commitTransaction();
      }

      return result;
    } catch (err) {
      if (session.inTransaction()) {
        try {
          await session.abortTransaction();
        } catch (abortErr) {
          console.warn(`[TransactionWrapper] Notice on abort: ${abortErr.message}`);
        }
      }

      // Check if transient transaction error or write conflict can be retried
      const isTransient = (
        (typeof err.hasErrorLabel === 'function' && (
          err.hasErrorLabel('TransientTransactionError') ||
          err.hasErrorLabel('UnknownTransactionCommitResult')
        )) ||
        (Array.isArray(err.errorLabels) && (
          err.errorLabels.includes('TransientTransactionError') ||
          err.errorLabels.includes('UnknownTransactionCommitResult')
        )) ||
        err.code === 112 ||
        (err.message && (
          err.message.includes('WriteConflict') ||
          err.message.includes('Write conflict') ||
          err.message.includes('write conflict') ||
          err.message.includes('transient transaction error')
        ))
      );

      if (isTransient && attempt <= maxRetries) {
        // Exponential jittered backoff to allow concurrent Atlas transaction to commit
        const delay = Math.min(1000, 100 * Math.pow(1.5, attempt - 1) + Math.floor(Math.random() * 50));
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw err;
    } finally {
      await session.endSession();
    }
  }
}

module.exports = {
  withTransaction
};
