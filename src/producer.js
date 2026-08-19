const amqp = require("amqplib");

const RABBITMQ_URL = "amqp://localhost";

const EXCHANGE = "retail.events";
const QUEUE = "inventory.sales";
const ROUTING_KEY = "sale.completed";

const DLX = "retail.dlx";
const DLQ_ROUTING_KEY = "sale.failed";

async function publishSaleEvent() {
  let connection;

  try {
    connection = await amqp.connect(RABBITMQ_URL);

    const channel = await connection.createConfirmChannel();

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
          "x-dead-letter-routing-key": DLQ_ROUTING_KEY
        }
      }
    );

    await channel.bindQueue(
      QUEUE,
      EXCHANGE,
      ROUTING_KEY
    );

    const saleEvent = {
      eventId: "SALE-NBO-CBD-0001",
      eventType: "SALE_COMPLETED",
      branchId: "NBO-CBD-01",
      receiptNumber: "RCPT-20260819-0001",
      sku: "TSH-BLU-M",
      quantitySold: 2,
      unitPrice: 1800,
      timestamp: new Date().toISOString()
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
      console.log("RabbitMQ write buffer is full.");
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