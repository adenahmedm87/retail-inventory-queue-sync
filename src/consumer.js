const amqp = require("amqplib");

const {
  reduceStock
} = require("./inventoryStore");

const {
  hasProcessedEvent,
  markEventProcessed
} = require("./processedEventStore");

const {
  validateSaleEvent
} = require("./eventValidator");

const {
  recordTransaction
} = require("./transactionStore");

const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  "amqp://localhost";

const EXCHANGE = "retail.events";
const QUEUE = "inventory.sales";
const ROUTING_KEY = "sale.completed";

const DLX = "retail.dlx";
const DLQ = "inventory.sales.dlq";
const DLQ_ROUTING_KEY = "sale.failed";

async function startConsumer() {
  try {
    const connection =
      await amqp.connect(RABBITMQ_URL);

    const channel =
      await connection.createChannel();

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
      DLQ,
      { durable: true }
    );

    await channel.bindQueue(
      DLQ,
      DLX,
      DLQ_ROUTING_KEY
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

    await channel.prefetch(1);

    console.log(
      "Inventory consumer is waiting for sale events..."
    );

    channel.consume(
      QUEUE,
      async (message) => {
        if (!message) {
          return;
        }

        try {
          const saleEvent =
            JSON.parse(
              message.content.toString()
            );

          console.log(
            "\nSale event received:"
          );

          console.log(saleEvent);

          validateSaleEvent(saleEvent);

          console.log(
            "\nEvent validation passed."
          );

          if (
            hasProcessedEvent(
              saleEvent.eventId
            )
          ) {
            console.log(
              "\nDuplicate event ignored:",
              saleEvent.eventId
            );

            channel.ack(message);

            console.log(
              "\nMessage acknowledged."
            );

            return;
          }

          const inventoryResult =
            reduceStock(
              saleEvent.sku,
              saleEvent.quantitySold
            );

          console.log(
            "\nInventory updated:"
          );

          console.log(
            inventoryResult
          );

          recordTransaction({
            eventId:
              saleEvent.eventId,

            branchId:
              saleEvent.branchId,

            receiptNumber:
              saleEvent.receiptNumber,

            sku:
              saleEvent.sku,

            quantitySold:
              saleEvent.quantitySold,

            previousQuantity:
              inventoryResult.previousQuantity,

            newQuantity:
              inventoryResult.newQuantity,

            lowStock:
              inventoryResult.lowStock
          });

          console.log(
            "\nTransaction recorded."
          );

          markEventProcessed(
            saleEvent.eventId
          );

          console.log(
            "\nEvent recorded as processed:",
            saleEvent.eventId
          );

          channel.ack(message);

          console.log(
            "\nMessage acknowledged."
          );
        } catch (error) {
          console.error(
            "\nFailed to process sale event:",
            error.message
          );

          channel.nack(
            message,
            false,
            false
          );

          console.log(
            "\nMessage rejected and sent to dead-letter queue."
          );
        }
      },
      {
        noAck: false
      }
    );
  } catch (error) {
    console.error(
      "Failed to start inventory consumer:",
      error.message
    );
  }
}

if (require.main === module) {
  startConsumer();
}

module.exports = {
  startConsumer
};