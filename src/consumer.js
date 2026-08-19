const amqp = require("amqplib");
const { reduceStock } = require("./inventoryStore");
const {
  hasProcessedEvent,
  markEventProcessed
} = require("./processedEventStore");

const RABBITMQ_URL = "amqp://localhost";

const EXCHANGE = "retail.events";
const QUEUE = "inventory.sales";
const ROUTING_KEY = "sale.completed";

async function startConsumer() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
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

    channel.prefetch(1);

    console.log(
      "Inventory consumer is waiting for sale events..."
    );

    channel.consume(
      QUEUE,
      (message) => {
        if (!message) {
          return;
        }

        try {
          const saleEvent = JSON.parse(
            message.content.toString()
          );

          console.log("\nSale event received:");
          console.log(saleEvent);

          if (hasProcessedEvent(saleEvent.eventId)) {
            console.log(
              `\nDuplicate event ignored: ${saleEvent.eventId}`
            );

            channel.ack(message);
            return;
          }

          const result = reduceStock(
            saleEvent.sku,
            saleEvent.quantitySold
          );

          markEventProcessed(saleEvent.eventId);

          console.log("\nInventory updated:");
          console.log(result);

          console.log(
            `\nEvent recorded as processed: ${saleEvent.eventId}`
          );

          channel.ack(message);

          console.log("\nMessage acknowledged.");
        } catch (error) {
          console.error(
            "\nFailed to process sale event:",
            error.message
          );

          channel.nack(message, false, false);
        }
      },
      {
        noAck: false
      }
    );
  } catch (error) {
    console.error(
      "Consumer failed to start:",
      error.message
    );
  }
}

startConsumer();