const amqp = require("amqplib");

const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  "amqp://localhost";

const PORT =
  process.env.PORT || 3000;

const EXCHANGE =
  "solstice.events";

const QUEUE =
  "badge.print.requests";

const ROUTING_KEY =
  "badge.print.requested";

function getPrintDelay(attendeeId) {
  const delays = {
    "ATT-001": 2000,
    "ATT-002": 500,
    "ATT-003": 4000
  };

  return delays[attendeeId] || 800;
}

async function startPrinterSimulator() {
  const connection =
    await amqp.connect(
      RABBITMQ_URL
    );

  const channel =
    await connection.createChannel();

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

  console.log(
    "Badge printer simulator is waiting for print requests..."
  );

  channel.consume(
    QUEUE,
    (message) => {
      if (!message) {
        return;
      }

      let printRequest;

      try {
        printRequest =
          JSON.parse(
            message.content.toString()
          );
      } catch (error) {
        console.error(
          "Invalid print request:",
          error.message
        );

        channel.nack(
          message,
          false,
          false
        );

        return;
      }

      const delay =
        getPrintDelay(
          printRequest.attendeeId
        );

      console.log(
        `Printing badge for ${printRequest.attendeeName} (${delay}ms)`
      );

      setTimeout(
        async () => {
          try {
            const response =
              await fetch(
                `http://localhost:${PORT}/webhooks/print-completed`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type":
                      "application/json"
                  },
                  body:
                    JSON.stringify({
                      printJobId:
                        printRequest.printJobId,
                      status:
                        "COMPLETED"
                    })
                }
              );

            const result =
              await response.json();

            if (response.ok) {
              console.log(
                "Webhook callback completed:",
                printRequest.printJobId
              );

              channel.ack(
                message
              );

              return;
            }

            console.error(
              "Webhook rejected print job:",
              result.error
            );

            channel.nack(
              message,
              false,
              false
            );

          } catch (error) {
            console.error(
              "Webhook callback failed:",
              error.message
            );

            channel.nack(
              message,
              false,
              true
            );
          }
        },
        delay
      );
    }
  );
}

if (
  require.main === module
) {
  startPrinterSimulator()
    .catch(
      (error) => {
        console.error(
          "Printer simulator failed:",
          error.message
        );

        process.exit(1);
      }
    );
}

module.exports = {
  startPrinterSimulator
};