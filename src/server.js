const express = require("express");
const cors = require("cors");
const amqp = require("amqplib");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

app.use(cors());
app.use(express.json());

app.use(
  express.static(
    path.join(__dirname, "..")
  )
);

const PORT = process.env.PORT || 3000;

const RABBITMQ_URL =
  process.env.RABBITMQ_URL || "amqp://localhost";

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

const transactionsPath = path.join(
  __dirname,
  "../data/transactions.json"
);

function loadJson(filePath) {
  const content = fs.readFileSync(
    filePath,
    "utf8"
  );

  return JSON.parse(content);
}

app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    service: "Retail Inventory Queue Sync"
  });
});

app.get("/api/inventory", (req, res) => {
  try {
    const inventory = loadJson(inventoryPath);

    res.json(inventory);
  } catch (error) {
    res.status(500).json({
      error: "Could not load inventory."
    });
  }
});

app.get("/api/transactions", (req, res) => {
  try {
    const transactions =
      loadJson(transactionsPath);

    res.json(transactions);
  } catch (error) {
    res.status(500).json({
      error: "Could not load transactions."
    });
  }
});

app.post("/api/sales", async (req, res) => {
  let connection;

  try {
    const {
      branchId,
      sku,
      quantitySold
    } = req.body;

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

    const branch = branches.find(
      (item) => item.branchId === branchId
    );

    if (!branch) {
      return res.status(400).json({
        error: "Unknown branch."
      });
    }

    const product = inventory.find(
      (item) => item.sku === sku
    );

    if (!product) {
      return res.status(400).json({
        error: "Unknown product."
      });
    }

    const quantity = Number(quantitySold);

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return res.status(400).json({
        error:
          "Quantity must be a positive whole number."
      });
    }

    const saleEvent = {
      eventId:
        `SALE-${crypto.randomUUID()}`,
      eventType: "SALE_COMPLETED",
      branchId,
      receiptNumber:
        `RCPT-${Date.now()}`,
      sku,
      quantitySold: quantity,
      unitPrice: product.unitPrice,
      timestamp:
        new Date().toISOString()
    };

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

    channel.publish(
      EXCHANGE,
      ROUTING_KEY,
      Buffer.from(
        JSON.stringify(saleEvent)
      ),
      {
        persistent: true,
        contentType: "application/json"
      }
    );

    await channel.waitForConfirms();
    await channel.close();

    res.status(202).json({
      message:
        "Sale event accepted by RabbitMQ.",
      event: saleEvent
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error:
        "Failed to send sale event to RabbitMQ."
    });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

app.listen(PORT, () => {
  console.log(
    `API server running on http://localhost:${PORT}`
  );
});