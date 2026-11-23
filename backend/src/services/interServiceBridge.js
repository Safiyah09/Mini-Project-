const { getWarehouseConnection } = require('../config/warehouseDatabase');
const { getPharmacyConnection } = require('../config/pharmacyDatabase');
const { getWarehouseModels } = require('../models/warehouse');
const { getPharmacyModels } = require('../models/pharmacy');
const ApiError = require('../utils/ApiError');
const { SUPPLY_REQUEST_STATUS, ALERT_TYPES, ALERT_STATUS } = require('../utils/constants');

/**
 * Inter-Service Bridge: Handles loosely coupled communication between
 * Central Warehouse database and distributed Pharmacy databases.
 */

/**
 * 1. Transmit a Pharmacy Supply Request to Central Warehouse
 * Takes a request ID from a pharmacy database and creates/syncs a corresponding
 * supply request in the central warehouse system.
 */
const transmitPharmacyRequestToWarehouse = async (pharmacyDbName, pharmacyRequestId) => {
  const pharmConn = await getPharmacyConnection(pharmacyDbName);
  const pharmModels = getPharmacyModels(pharmConn);

  const pharmReqDoc = await pharmModels.SupplyRequest.findById(pharmacyRequestId);
  if (!pharmReqDoc) {
    throw ApiError.notFound(`Supply request not found in pharmacy database: ${pharmacyRequestId}`);
  }

  const pharmItems = await pharmModels.RequestItem.find({ supply_request: pharmReqDoc._id })
    .populate('medicine');

  if (!pharmItems || pharmItems.length === 0) {
    throw ApiError.badRequest('Supply request has no items to transmit.');
  }

  // Connect to Central Warehouse
  const whConn = await getWarehouseConnection();
  const whModels = getWarehouseModels(whConn);

  // Find or map the Pharmacy entity in warehouse database
  let whPharmacy = await whModels.Pharmacy.findOne({
    $or: [
      { pharmacy_id: (pharmacyDbName || '').toUpperCase() },
      { name: { $regex: pharmacyDbName || '', $options: 'i' } }
    ]
  });

  if (!whPharmacy) {
    // Look up default pharmacy
    whPharmacy = await whModels.Pharmacy.findOne();
  }

  if (!whPharmacy) {
    throw ApiError.internal('No pharmacy registry found in central warehouse database.');
  }

  // Check if already transmitted to warehouse
  let whReq = await whModels.SupplyRequest.findOne({
    request_id: pharmReqDoc.request_id
  });

  if (!whReq) {
    whReq = await whModels.SupplyRequest.create({
      request_id: pharmReqDoc.request_id,
      pharmacy: whPharmacy._id,
      request_date: pharmReqDoc.request_date || new Date(),
      status: SUPPLY_REQUEST_STATUS.PENDING
    });

    for (let i = 0; i < pharmItems.length; i++) {
      const pItm = pharmItems[i];
      // Resolve medicine in warehouse database by medicine_id
      let whMed = null;
      if (pItm.medicine && pItm.medicine.medicine_id) {
        whMed = await whModels.Medicine.findOne({ medicine_id: pItm.medicine.medicine_id });
      }
      if (!whMed) {
        whMed = await whModels.Medicine.findOne();
      }

      await whModels.RequestItem.create({
        request_item_id: pItm.request_item_id || `RQI-${whReq.request_id}-${(i + 1).toString().padStart(2, '0')}`,
        supply_request: whReq._id,
        medicine: whMed ? whMed._id : null,
        quantity_requested: pItm.quantity_requested,
        quantity_fulfilled: 0,
        quantity_pending: pItm.quantity_requested,
        is_backordered: false
      });
    }

    if (whModels.OrderStatusHistory) {
      await whModels.OrderStatusHistory.create({
        history_id: `OSH-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        order_id: whReq._id,
        request_id: whReq.request_id,
        from_status: 'NONE',
        to_status: 'PENDING',
        username: 'SERVICE_BRIDGE',
        notes: `Transmitted from branch pharmacy ${pharmacyDbName}`,
        created_at: new Date()
      });
    }
  }

  return {
    pharmacyRequestId: pharmReqDoc.request_id,
    warehouseRequestId: whReq.request_id,
    warehousePharmacyId: whPharmacy.pharmacy_id,
    pharmacyName: whPharmacy.name,
    status: whReq.status,
    itemsCount: pharmItems.length,
    transmittedAt: new Date()
  };
};

/**
 * 2. Lookup Warehouse Transfer Manifest for Pharmacy Inward Receipt
 * Called by branch pharmacy to query dispatch manifest directly from warehouse
 * using external transfer_id.
 */
const lookupWarehouseTransferManifest = async (transferId) => {
  const whConn = await getWarehouseConnection();
  const whModels = getWarehouseModels(whConn);

  const idStr = (transferId || '').toString();
  let transfer = null;
  if (idStr.match(/^[0-9a-fA-F]{24}$/)) {
    transfer = await whModels.StockTransfer.findById(idStr).populate('pharmacy');
  }
  if (!transfer) {
    transfer = await whModels.StockTransfer.findOne({ transfer_id: idStr.toUpperCase() }).populate('pharmacy');
  }

  if (!transfer) {
    throw ApiError.notFound(`Stock transfer not found in Central Warehouse: ${transferId}`);
  }

  const transferItems = await whModels.TransferItem.find({ stock_transfer: transfer._id })
    .populate({
      path: 'batch',
      populate: { path: 'medicine' }
    });

  const manifestItems = transferItems.map((item) => ({
    transfer_item_id: item.transfer_item_id,
    batch_number: item.batch ? item.batch.batch_number : null,
    medicine_id: item.batch && item.batch.medicine ? item.batch.medicine.medicine_id : null,
    medicine_name: item.batch && item.batch.medicine ? item.batch.medicine.name : null,
    dosage: item.batch && item.batch.medicine ? item.batch.medicine.dosage : null,
    formulation: item.batch && item.batch.medicine ? item.batch.medicine.formulation : null,
    manufacturing_date: item.batch ? item.batch.manufacturing_date : null,
    expiry_date: item.batch ? item.batch.expiry_date : null,
    quantity_dispatched: item.quantity_dispatched,
    unit_cost: item.batch && item.batch.unit_cost ? item.batch.unit_cost.toString() : '0.00'
  }));

  return {
    transfer_id: transfer.transfer_id,
    status: transfer.status,
    dispatch_date: transfer.dispatch_date || transfer.transfer_date,
    pharmacy_id: transfer.pharmacy ? transfer.pharmacy.pharmacy_id : null,
    pharmacy_name: transfer.pharmacy ? transfer.pharmacy.name : null,
    shipping_reference: transfer.shipping_reference,
    item_count: manifestItems.length,
    items: manifestItems
  };
};

/**
 * 3. Warehouse Broadcasts Dispatch Notification to Branch Pharmacy
 * Sends an alert directly into the branch pharmacy database when goods leave warehouse.
 */
const notifyPharmacyOfTransferDispatch = async (transferId) => {
  const whConn = await getWarehouseConnection();
  const whModels = getWarehouseModels(whConn);

  const transfer = await whModels.StockTransfer.findById(transferId).populate('pharmacy');
  if (!transfer) {
    throw ApiError.notFound(`Transfer not found: ${transferId}`);
  }

  // Determine branch pharmacy database name
  const branchDbName = (transfer.pharmacy && transfer.pharmacy.connection_details && transfer.pharmacy.connection_details.db_name)
    ? transfer.pharmacy.connection_details.db_name
    : 'pharmacy';

  const pharmConn = await getPharmacyConnection(branchDbName);
  const pharmModels = getPharmacyModels(pharmConn);

  // Retrieve transfer items count
  const itemsCount = await whModels.TransferItem.countDocuments({ stock_transfer: transfer._id });

  // Post alert to pharmacy database
  const alertId = `ALT-DSP-${Date.now().toString().slice(-6)}`;
  const alert = await pharmModels.Alert.create({
    alert_id: alertId,
    alert_type: ALERT_TYPES.STOCK_IN_TRANSIT,
    message: `Shipment dispatched from Central Warehouse! Transfer ID: ${transfer.transfer_id} containing ${itemsCount} lot(s). Reference: ${transfer.shipping_reference || 'N/A'}`,
    resolved: false,
    created_at: new Date()
  });

  return {
    notified: true,
    pharmacyDb: branchDbName,
    transferId: transfer.transfer_id,
    alertId: alert.alert_id,
    message: alert.message
  };
};

module.exports = {
  transmitPharmacyRequestToWarehouse,
  lookupWarehouseTransferManifest,
  getTransferManifest: lookupWarehouseTransferManifest,
  notifyPharmacyOfTransferDispatch
};
