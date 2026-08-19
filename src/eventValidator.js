function validateSaleEvent(event) {
  if (!event || typeof event !== "object") {
    throw new Error("Event must be a valid object");
  }

  if (!event.eventId || typeof event.eventId !== "string") {
    throw new Error("Missing or invalid eventId");
  }

  if (event.eventType !== "SALE_COMPLETED") {
    throw new Error(
      `Unsupported eventType: ${event.eventType}`
    );
  }

  if (!event.branchId || typeof event.branchId !== "string") {
    throw new Error("Missing or invalid branchId");
  }

  if (!event.receiptNumber || typeof event.receiptNumber !== "string") {
    throw new Error("Missing or invalid receiptNumber");
  }

  if (!event.sku || typeof event.sku !== "string") {
    throw new Error("Missing or invalid sku");
  }

  if (
    !Number.isInteger(event.quantitySold) ||
    event.quantitySold <= 0
  ) {
    throw new Error(
      "quantitySold must be a positive whole number"
    );
  }

  if (
    typeof event.unitPrice !== "number" ||
    event.unitPrice < 0
  ) {
    throw new Error("Missing or invalid unitPrice");
  }

  if (!event.timestamp || typeof event.timestamp !== "string") {
    throw new Error("Missing or invalid timestamp");
  }

  return true;
}

module.exports = {
  validateSaleEvent
};