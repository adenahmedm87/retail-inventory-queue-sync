const amqp = require("amqplib");

const RABBITMQ_URL = "amqp://localhost";

const EXCHANGE = "retail.events";
const QUEUE = "inventory.sales";
const ROUTING_KEY = "sale.completed";

async function publishSaleEvent() {
  let connection;

  try {
    connection = await amqp.connect(RABBITMQ_URL);

    const channel = await connection.createChannel();

    await channel.assertExchange(
      EXCHANGE,
      "direct",
      { durable: true }
    );

    await channel.assertQueue(
      QUEUE,
      { durable: true }
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