const fs = require("fs");
const path = require("path");

const inventoryPath = path.join(
  __dirname,
  "..",
  "data",
  "inventory.json"
);

function loadInventory() {
  const rawData = fs.readFileSync(inventoryPath, "utf8");
  return JSON.parse(rawData);
}

function saveInventory(inventory) {
  fs.writeFileSync(
    inventoryPath,
    JSON.stringify(inventory, null, 2),
    "utf8"
  );
}

function findProductBySku(sku) {
  const inventory = loadInventory();

  return inventory.find(
    (product) => product.sku === sku
  );
}

function reduceStock(sku, quantitySold) {
  const inventory = loadInventory();

  const product = inventory.find(
    (item) => item.sku === sku
  );

  if (!product) {
    throw new Error(`Product not found: ${sku}`);
  }

  if (!Number.isInteger(quantitySold) || quantitySold <= 0) {
    throw new Error(
      "Quantity sold must be a positive whole number"
    );
  }

  if (product.quantity < quantitySold) {
    throw new Error(
      `Insufficient stock for ${sku}. Available: ${product.quantity}`
    );
  }

  const previousQuantity = product.quantity;

  product.quantity -= quantitySold;

  saveInventory(inventory);

  return {
    sku: product.sku,
    name: product.name,
    previousQuantity,
    quantitySold,
    newQuantity: product.quantity,
    reorderLevel: product.reorderLevel,
    lowStock: product.quantity <= product.reorderLevel
  };
}

module.exports = {
  loadInventory,
  findProductBySku,
  reduceStock
};