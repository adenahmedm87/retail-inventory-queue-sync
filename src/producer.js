const amqp = require("amqplib");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const RABBITMQ_URL = "amqp://localhost";

const EXCHANGE = "retail.events";
const QUEUE = "inventory.sales";
const ROUTING_KEY = "sale.completed";

const DLX = "retail.dlx";
const DLQ_ROUTING_KEY = "sale.failed";

const branchesPath = path.join(
  __dirname,
  "../data/branches.json"
);

const inventoryPath = path.join(
  __dirname,
  "../data/inventory.json"
);

function loadJson(filePath) {
  const fileContent = fs.readFileSync(
    filePath,
    "utf8"
  );

  return JSON.parse(fileContent);
}

async function publishSaleEvent() {
  let connection;

  try {
    connection = await amqp.connect(
      RABBITMQ_URL
    );

    const channel =
      await connection.createConfirmChannel();

    await channel.assertExchange(
      EXCHANGE,
      "direct",
      { durable: true }
    );

    await channel.assertExchange(
      DLX,
      "direct",
      { durable: true }
    );

    await channel.assertQueue(
      QUEUE,
      {
        durable: true,
        arguments: {
          "x-dead-letter-exchange": DLX,
          "x-dead-letter-routing-key":
            DLQ_ROUTING_KEY
        }
      }
    );

    await channel.bindQueue(
      QUEUE,
      EXCHANGE,
      ROUTING_KEY
    );

    const branchesData =
      loadJson(branchesPath);

    const inventoryData =
      loadJson(inventoryPath);

    const branches = Array.isArray(branchesData)
      ? branchesData
      : branchesData.branches;

    const inventory = Array.isArray(inventoryData)
      ? inventoryData
      : inventoryData.products;

    const branchId =
      process.argv[2] || "NBO-CBD-01";

    const sku =
      process.argv[3] || "TSH-BLU-M";

    const quantitySold =
      Number(process.argv[4] || 1);

    const branch = branches.find(
      (item) => item.branchId === branchId
    );

    if (!branch) {
      throw new Error(
        `Unknown branch: ${branchId}`
      );
    }

    const product = inventory.find(
      (item) => item.sku === sku
    );

    if (!product) {
      throw new Error(
        `Unknown product SKU: ${sku}`
      );
    }

    if (
      !Number.isInteger(quantitySold) ||
      quantitySold <= 0
    ) {
      throw new Error(
        "Quantity must be a positive whole number."
      );
    }

    const saleId =
      crypto.randomUUID();

    const saleEvent = {
      eventId: `SALE-${saleId}`,
      eventType: "SALE_COMPLETED",
      branchId: branchId,
      receiptNumber:
        `RCPT-${Date.now()}`,
      sku: sku,
      quantitySold: quantitySold,
      unitPrice: product.unitPrice,
      timestamp:
        new Date().toISOString()
    };

    const message = Buffer.from(
      JSON.stringify(saleEvent)
    );

    const published = channel.publish(
      EXCHANGE,
      ROUTING_KEY,
      message,
      {
        persistent: true,
        contentType: "application/json"
      }
    );

    await channel.waitForConfirms();

    if (!published) {
      console.log(
        "RabbitMQ write buffer is full."
      );
    }

    console.log("Sale event published:");
    console.log(saleEvent);

    await channel.close();
  } catch (error) {
    console.error(
      "Failed to publish sale event:",
      error.message
    );
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

publishSaleEvent();