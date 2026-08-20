const amqp = require("amqplib");

const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  "amqp://localhost";

const EXCHANGE = "solstice.events";
const QUEUE = "badge.print.requests";
const ROUTING_KEY = "badge.print.requested";

async function publishPrintRequest(printRequest) {
  let connection;

  try {
    connection =
      await amqp.connect(
        RABBITMQ_URL
      );

    const channel =
      await connection.createConfirmChannel();

    await channel.assertExchange(
      EXCHANGE,
      "direct",
      {
        durable: true
      }
    );

    await channel.assertQueue(
      QUEUE,
      {
        durable: true
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
        JSON.stringify(
          printRequest
        )
      ),
      {
        persistent: true,
        contentType:
          "application/json"
      }
    );

    await channel.waitForConfirms();

    console.log(
      "Badge print request published:",
      printRequest.printJobId
    );

    await channel.close();

    return printRequest;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

module.exports = {
  publishPrintRequest
};