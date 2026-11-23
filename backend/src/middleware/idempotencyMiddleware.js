/**
 * ============================================================================
 * ENGINE E4: IDEMPOTENCY MIDDLEWARE WITH REQUEST HASH VALIDATION
 * ============================================================================
 * Supports Idempotency-Key header on critical mutating operations (dispatch,
 * receipts, returns, adjustments, sales).
 * 
 * Guarantees:
 * 1. Safe retries: Repeated requests with the identical key return cached responses.
 * 2. Payload tampering prevention: Reusing the same key with a different request
 *    body is rejected with 422 IDEMPOTENCY_PAYLOAD_MISMATCH.
 * 3. Race condition prevention: In-flight requests lock the key.
 * ============================================================================
 */

const crypto = require('crypto');
const ApiError = require('../utils/ApiError');

/**
 * Middleware factory for Idempotency verification
 */
const idempotencyMiddleware = async (req, res, next) => {
  const rawKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

  // If no idempotency key is provided, proceed normally
  if (!rawKey) {
    return next();
  }

  const key = String(rawKey).trim();
  if (!key) {
    return next();
  }

  const IdempotencyRecord = req.models ? req.models.IdempotencyRecord : null;
  if (!IdempotencyRecord) {
    return next();
  }

  try {
    const endpoint = (req.originalUrl || req.path).split('?')[0].toLowerCase();

    // Generate deterministic SHA-256 hash of the request payload
    const payloadString = JSON.stringify(req.body || {});
    const requestHash = crypto.createHash('sha256').update(payloadString).digest('hex');

    const existing = await IdempotencyRecord.findOne({ key, endpoint });

    if (existing) {
      // 1. Verify that the request body matches the original payload
      if (existing.request_hash !== requestHash) {
        throw ApiError.idempotencyMismatch(
          `Idempotency key '${key}' reused with a different request payload on endpoint '${endpoint}'`,
          [{
            key,
            endpoint,
            originalHash: existing.request_hash,
            currentHash: requestHash
          }]
        );
      }

      // 2. If already completed, replay the exact cached response
      if (existing.status === 'COMPLETED') {
        res.set('X-Idempotency-Replay', 'true');
        return res.status(existing.response_status || 200).json(existing.response_body);
      }

      // 3. If currently processing, reject concurrent duplicate attempt
      if (existing.status === 'PROCESSING') {
        return res.status(409).json({
          success: false,
          statusCode: 409,
          error_code: 'CONCURRENT_REQUEST_IN_FLIGHT',
          message: `A request with idempotency key '${key}' is currently being processed. Please retry shortly.`,
          details: [{ key, endpoint }]
        });
      }
    }

    // Register key in PROCESSING state (handles concurrent insert race condition via unique index)
    try {
      await IdempotencyRecord.create({
        key,
        endpoint,
        method: req.method,
        request_hash: requestHash,
        status: 'PROCESSING'
      });
    } catch (createErr) {
      if (createErr.code === 11000) {
        return res.status(409).json({
          success: false,
          statusCode: 409,
          error_code: 'CONCURRENT_REQUEST_IN_FLIGHT',
          message: `A request with idempotency key '${key}' is currently being processed. Please retry shortly.`,
          details: [{ key, endpoint }]
        });
      }
      throw createErr;
    }

    // Intercept outgoing JSON response to cache successful completions
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      const statusCode = res.statusCode;

      if (statusCode >= 200 && statusCode < 400) {
        IdempotencyRecord.updateOne(
          { key, endpoint },
          {
            status: 'COMPLETED',
            response_status: statusCode,
            response_body: body
          }
        ).catch((err) => console.warn(`[Idempotency] Failed to cache response: ${err.message}`));
      } else {
        // Failed executions release the key so clients can retry safely
        IdempotencyRecord.deleteOne({ key, endpoint })
          .catch((err) => console.warn(`[Idempotency] Failed to cleanup key: ${err.message}`));
      }

      return originalJson(body);
    };

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = idempotencyMiddleware;
