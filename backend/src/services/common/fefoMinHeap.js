/**
 * ============================================================================
 * ENGINE E3: FEFO (FIRST-EXPIRED, FIRST-OUT) MIN-HEAP ALLOCATION ENGINE
 * ============================================================================
 * 
 * PHARMACEUTICAL RATIONALE:
 * In pharmaceutical logistics, central warehousing, and dispensary point-of-sale
 * management, dispensing or transferring drugs strictly requires prioritizing
 * batches with the earliest expiration dates (First-Expired, First-Out: FEFO).
 * 
 * This strategy:
 * 1. Minimizes stock expiration write-offs and financial degradation.
 * 2. Guarantees that patients and branch clinics receive medications with optimal
 *    shelf stability.
 * 3. Prevents dangerous dispensation of expired pharmaceutical items.
 * 
 * TIE-BREAKING POLICY:
 * When two batches possess the exact same expiration date:
 * - Priority 1: Earliest inward/received date (FIFO within same expiry).
 * - Priority 2: Creation timestamp or manufacturing date.
 * - Priority 3: Deterministic lexical comparison of batch identifier / batch number.
 * 
 * PSEUDOCODE:
 * ----------------------------------------------------------------------------
 * Algorithm FEFO-MinHeap-Allocation:
 * Input:
 *   batches: Array of candidate batch objects
 *     {
 *       batch_id: String,
 *       batch_number: String,
 *       expiry_date: Date | String,
 *       available_quantity: Number,
 *       received_date: Date | String (optional)
 *     }
 *   requestedQuantity: Positive integer
 *   options: { now: Date } (optional reference time for expiry evaluation)
 * Output:
 *   {
 *     status: "FULL" | "PARTIAL" | "NONE",
 *     requested_quantity: Number,
 *     allocated_quantity: Number,
 *     unfulfilled_quantity: Number,
 *     allocations: Array of { batch_id, batch_number, expiry_date, allocated_quantity, ... },
 *     eligible_batches_count: Number,
 *     expired_batches_count: Number
 *   }
 * 
 * Steps:
 * 1. currentTime <- options.now || new Date()
 * 2. eligibleBatches <- []
 * 3. expiredBatchesCount <- 0
 * 4. for each batch in batches:
 *      if batch.expiry_date <= currentTime:
 *        expiredBatchesCount <- expiredBatchesCount + 1
 *        continue
 *      if batch.available_quantity > 0:
 *        eligibleBatches.append(batch)
 * 5. if length(eligibleBatches) == 0:
 *      return {
 *        status: "NONE",
 *        requested_quantity: requestedQuantity,
 *        allocated_quantity: 0,
 *        unfulfilled_quantity: requestedQuantity,
 *        allocations: [],
 *        eligible_batches_count: 0,
 *        expired_batches_count: expiredBatchesCount
 *      }
 * 6. heap <- new MinHeap(compareBatchesFEFO)
 * 7. for each b in eligibleBatches:
 *      heap.insert(b)                             // Heapify build: O(n log n)
 * 8. remainingQty <- requestedQuantity
 * 9. allocations <- []
 * 10. while not heap.isEmpty() AND remainingQty > 0:
 *       topBatch <- heap.extractMin()             // Min extraction: O(k log n)
 *       takeQty <- min(remainingQty, topBatch.available_quantity)
 *       allocations.append({
 *         batch_id: topBatch.batch_id,
 *         batch_number: topBatch.batch_number,
 *         expiry_date: topBatch.expiry_date,
 *         received_date: topBatch.received_date,
 *         allocated_quantity: takeQty,
 *         available_quantity: topBatch.available_quantity,
 *         raw: topBatch
 *       })
 *       remainingQty <- remainingQty - takeQty
 * 11. if remainingQty == 0:
 *       status <- "FULL"
 *     else if remainingQty < requestedQuantity:
 *       status <- "PARTIAL"
 *     else:
 *       status <- "NONE"
 * 12. return { status, requested_quantity, allocated_quantity, unfulfilled_quantity, allocations, ... }
 * 
 * TIME & SPACE COMPLEXITY:
 * ----------------------------------------------------------------------------
 * Let n = total candidate batches for a medicine.
 * Let k = number of batches allocated to fulfill the request (1 <= k <= n).
 * 
 * Time Complexity:
 * - Filtering expired / zero-stock batches: O(n)
 * - Heap Construction:
 *     Inserting n elements into binary min-heap sequentially:
 *     Sum_{i=1}^n log(i) = O(n log n) time.
 * - FEFO Extraction Phase:
 *     Extracting k earliest-expiry batches from the heap:
 *     k * O(log n) = O(k log n) time.
 * - Total Runtime: O(n log n) build + O(k log n) extraction.
 *   In the worst case (k = n), Total Time = O(n log n).
 * 
 * Space Complexity:
 * - Auxiliary binary heap storage array: O(n).
 * - Output allocations list: O(k) <= O(n).
 * - Total Space Complexity: O(n).
 * 
 * PURE FUNCTION GUARANTEE:
 * - allocateFEFO does NOT alter any database row, in-memory Mongoose model,
 *   or incoming object property. It returns a pure allocation plan.
 * ============================================================================
 */

/**
 * Standard Array-based Binary Min-Heap
 */
class MinHeap {
  /**
   * @param {Function} comparator - (a, b) => negative if a < b, positive if a > b, 0 if equal
   */
  constructor(comparator) {
    if (typeof comparator !== 'function') {
      throw new TypeError('MinHeap requires a comparator function');
    }
    this.comparator = comparator;
    this.heap = [];
  }

  /**
   * Insert an element into the min-heap
   * Time Complexity: O(log n)
   * @param {any} item
   */
  insert(item) {
    this.heap.push(item);
    this._siftUp(this.heap.length - 1);
  }

  /**
   * Peek at the minimum element without removing it
   * Time Complexity: O(1)
   * @returns {any|null}
   */
  peek() {
    return this.heap.length > 0 ? this.heap[0] : null;
  }

  /**
   * Extract and remove the minimum element from the min-heap
   * Time Complexity: O(log n)
   * @returns {any|null}
   */
  extractMin() {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop();

    const minItem = this.heap[0];
    this.heap[0] = this.heap.pop();
    this._siftDown(0);
    return minItem;
  }

  /**
   * Get current number of elements
   * @returns {number}
   */
  size() {
    return this.heap.length;
  }

  /**
   * Check if heap is empty
   * @returns {boolean}
   */
  isEmpty() {
    return this.heap.length === 0;
  }

  /**
   * Return a shallow copy of the internal heap array
   * @returns {Array}
   */
  toArray() {
    return [...this.heap];
  }

  /**
   * Internal sift-up helper
   * @private
   */
  _siftUp(index) {
    let curr = index;
    while (curr > 0) {
      const parent = Math.floor((curr - 1) / 2);
      if (this.comparator(this.heap[curr], this.heap[parent]) < 0) {
        // Swap
        const temp = this.heap[curr];
        this.heap[curr] = this.heap[parent];
        this.heap[parent] = temp;
        curr = parent;
      } else {
        break;
      }
    }
  }

  /**
   * Internal sift-down helper
   * @private
   */
  _siftDown(index) {
    let curr = index;
    const length = this.heap.length;

    while (true) {
      let smallest = curr;
      const left = 2 * curr + 1;
      const right = 2 * curr + 2;

      if (left < length && this.comparator(this.heap[left], this.heap[smallest]) < 0) {
        smallest = left;
      }
      if (right < length && this.comparator(this.heap[right], this.heap[smallest]) < 0) {
        smallest = right;
      }

      if (smallest !== curr) {
        // Swap
        const temp = this.heap[curr];
        this.heap[curr] = this.heap[smallest];
        this.heap[smallest] = temp;
        curr = smallest;
      } else {
        break;
      }
    }
  }
}

/**
 * Comparator for FEFO batch allocation:
 * 1. Expiry Date (earliest expiry first)
 * 2. Received Date / Inward Date (earliest inward first)
 * 3. Batch Identifier / Number (deterministic tie-breaker)
 */
function compareBatchesFEFO(a, b) {
  // 1. Expiry date comparison
  const expA = new Date(a.expiry_date).getTime();
  const expB = new Date(b.expiry_date).getTime();
  if (expA !== expB) {
    return expA - expB;
  }

  // 2. Received / Inward date tie-breaker
  const recA = new Date(a.received_date || a.createdAt || a.inward_date || a.manufacturing_date || 0).getTime();
  const recB = new Date(b.received_date || b.createdAt || b.inward_date || b.manufacturing_date || 0).getTime();
  if (recA !== recB) {
    return recA - recB;
  }

  // 3. Batch ID / Batch Number tie-breaker
  const idA = String(a.batch_number || a.batch_id || a._id || '');
  const idB = String(b.batch_number || b.batch_id || b._id || '');
  return idA.localeCompare(idB);
}

/**
 * Pure FEFO batch allocation function.
 * Given a list of candidate batches and a target quantity, allocates stock
 * strictly according to FEFO using a min-heap priority queue.
 * 
 * @param {Array<Object>} candidateBatches - Array of batch objects with stock info
 * @param {number} requestedQuantity - Total units requested
 * @param {Object} [options] - Optional settings
 * @param {Date} [options.now] - Current time reference for expiry evaluation
 * @returns {Object} Allocation plan
 */
function allocateFEFO(candidateBatches, requestedQuantity, options = {}) {
  const now = options.now instanceof Date ? options.now : (options.now ? new Date(options.now) : new Date());
  const requested = Math.max(0, parseInt(requestedQuantity, 10) || 0);

  if (requested === 0) {
    return {
      status: 'FULL',
      requested_quantity: 0,
      allocated_quantity: 0,
      unfulfilled_quantity: 0,
      allocations: [],
      eligible_batches_count: 0,
      expired_batches_count: 0,
      total_unexpired_available: 0
    };
  }

  if (!Array.isArray(candidateBatches) || candidateBatches.length === 0) {
    return {
      status: 'NONE',
      requested_quantity: requested,
      allocated_quantity: 0,
      unfulfilled_quantity: requested,
      allocations: [],
      eligible_batches_count: 0,
      expired_batches_count: 0,
      total_unexpired_available: 0
    };
  }

  // 1. Filter eligible non-expired batches with positive available stock
  let expiredCount = 0;
  const eligible = [];
  let totalUnexpiredAvailable = 0;

  for (let i = 0; i < candidateBatches.length; i++) {
    const raw = candidateBatches[i];
    const expDate = new Date(raw.expiry_date);

    // Rule: Exclude expired batches strictly (expiry_date <= now)
    if (isNaN(expDate.getTime()) || expDate <= now) {
      expiredCount++;
      continue;
    }

    const available = Math.max(
      0,
      parseInt(raw.available_quantity !== undefined ? raw.available_quantity : (raw.quantity_on_hand || 0), 10)
    );

    if (available > 0) {
      totalUnexpiredAvailable += available;
      eligible.push({
        _id: raw._id,
        batch_id: raw.batch_id,
        batch_number: raw.batch_number,
        expiry_date: expDate,
        received_date: raw.received_date || raw.createdAt || raw.inward_date || raw.manufacturing_date,
        available_quantity: available,
        storage_location: raw.storage_location,
        unit_price: raw.unit_price,
        raw_reference: raw
      });
    }
  }

  if (eligible.length === 0) {
    return {
      status: 'NONE',
      requested_quantity: requested,
      allocated_quantity: 0,
      unfulfilled_quantity: requested,
      allocations: [],
      eligible_batches_count: 0,
      expired_batches_count: expiredCount,
      total_unexpired_available: 0
    };
  }

  // 2. Build Min-Heap: O(n log n)
  const heap = new MinHeap(compareBatchesFEFO);
  for (let i = 0; i < eligible.length; i++) {
    heap.insert(eligible[i]);
  }

  // 3. Extract min-expiry batches until requested quantity is satisfied: O(k log n)
  let remaining = requested;
  const allocations = [];

  while (!heap.isEmpty() && remaining > 0) {
    const batch = heap.extractMin();
    const takeQty = Math.min(remaining, batch.available_quantity);

    allocations.push({
      _id: batch._id,
      batch_id: batch.batch_id,
      batch_number: batch.batch_number,
      expiry_date: batch.expiry_date,
      received_date: batch.received_date,
      allocated_quantity: takeQty,
      available_quantity: batch.available_quantity,
      remaining_in_batch: batch.available_quantity - takeQty,
      storage_location: batch.storage_location,
      unit_price: batch.unit_price,
      raw_reference: batch.raw_reference
    });

    remaining -= takeQty;
  }

  const allocatedTotal = requested - remaining;
  let status = 'NONE';
  if (remaining === 0) {
    status = 'FULL';
  } else if (allocatedTotal > 0) {
    status = 'PARTIAL';
  }

  return {
    status,
    requested_quantity: requested,
    allocated_quantity: allocatedTotal,
    unfulfilled_quantity: remaining,
    allocations,
    eligible_batches_count: eligible.length,
    expired_batches_count: expiredCount,
    total_unexpired_available: totalUnexpiredAvailable
  };
}

module.exports = {
  MinHeap,
  compareBatchesFEFO,
  allocateFEFO
};
