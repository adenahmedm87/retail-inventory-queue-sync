const express = require("express");
const cors = require("cors");
const amqp = require("amqplib");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const {
  startConsumer
} = require("./consumer");

const {
  prepareCheckIn
} = require("./checkInService");

const {
  publishPrintRequest
} = require("./printQueue");

const {
  startPrinterSimulator
} = require("./printerSimulator");

const {
  loadAttendees,
  rollbackPendingPrint,
  confirmPrintJob
} = require("./attendeeStore");

const app = express();

app.use(cors());
app.use(express.json());

app.use(
  express.static(
    path.join(__dirname, "..")
  )
);

const PORT =
  process.env.PORT || 3000;

const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  "amqp://localhost";

/*
  ------------------------------------------------
  ASSIGNMENT 1 RETAIL PROTOTYPE

  Temporarily kept during the Day 4 refactor.
  It will be removed/deprecated from the final
  Assignment 2 active application.
  ------------------------------------------------
*/

const EXCHANGE =
  "retail.events";

const QUEUE =
  "inventory.sales";

const ROUTING_KEY =
  "sale.completed";

const DLX =
  "retail.dlx";

const DLQ_ROUTING_KEY =
  "sale.failed";

const branchesPath =
  path.join(
    __dirname,
    "../data/branches.json"
  );

const inventoryPath =
  path.join(
    __dirname,
    "../data/inventory.json"
  );

const transactionsPath =
  path.join(
    __dirname,
    "../data/transactions.json"
  );

function loadJson(filePath) {
  const content =
    fs.readFileSync(
      filePath,
      "utf8"
    );

  return JSON.parse(content);
}

/*
  ------------------------------------------------
  HEALTH
  ------------------------------------------------
*/

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      status: "online",
      service:
        "Solstice Events Check-In Service"
    });
  }
);

/*
  ------------------------------------------------
  SOLSTICE EVENTS - ATTENDEES
  ------------------------------------------------
*/

app.get(
  "/api/attendees",
  (req, res) => {
    try {
      const attendees =
        loadAttendees();

      res.json(attendees);

    } catch (error) {
      console.error(
        "Attendee load error:",
        error.message
      );

      res.status(500).json({
        error:
          "Could not load attendees."
      });
    }
  }
);

/*
  ------------------------------------------------
  SOLSTICE EVENTS - QR CHECK-IN

  QR scan
      ↓
  Create print job
      ↓
  PENDING_PRINT
      ↓
  Publish to RabbitMQ

  If RabbitMQ publishing fails:
  PENDING_PRINT
      ↓
  rollback
      ↓
  NOT_CHECKED_IN
  ------------------------------------------------
*/

app.post(
  "/api/checkin",
  async (req, res) => {
    let preparedCheckIn = null;

    try {
      const {
        qrCode
      } = req.body;

      if (!qrCode) {
        return res
          .status(400)
          .json({
            error:
              "QR code is required."
          });
      }

      preparedCheckIn =
        prepareCheckIn(
          qrCode
        );

      const {
        attendee,
        printJobId
      } = preparedCheckIn;

      const printRequest = {
        printJobId,

        attendeeId:
          attendee.attendeeId,

        attendeeName:
          attendee.name,

        ticketType:
          attendee.ticketType,

        requestedAt:
          new Date().toISOString()
      };

      try {
        await publishPrintRequest(
          printRequest
        );

      } catch (publishError) {
        rollbackPendingPrint(
          attendee.attendeeId,
          printJobId
        );

        console.error(
          "RabbitMQ publish failed:",
          publishError.message
        );

        return res
          .status(503)
          .json({
            error:
              "Badge print request could not be queued. Check-in was rolled back."
          });
      }

      res.status(202).json({
        message:
          "Badge print request queued.",

        status:
          "PENDING_PRINT",

        printJobId,

        attendee
      });

    } catch (error) {
      console.error(
        "Check-in error:",
        error.message
      );

      res.status(400).json({
        error:
          error.message
      });
    }
  }
);

/*
  ------------------------------------------------
  SOLSTICE EVENTS - PRINT WEBHOOK

  Printer finishes
      ↓
  Webhook receives printJobId
      ↓
  Correct attendee is matched
      ↓
  CHECKED_IN
  ------------------------------------------------
*/

app.post(
  "/webhooks/print-completed",
  (req, res) => {
    try {
      const {
        printJobId,
        status
      } = req.body;

      if (!printJobId) {
        return res
          .status(400)
          .json({
            error:
              "printJobId is required."
          });
      }

      if (
        status &&
        status !== "COMPLETED"
      ) {
        return res
          .status(400)
          .json({
            error:
              "Print job is not completed."
          });
      }

      const result =
        confirmPrintJob(
          printJobId
        );

      if (
        result.duplicateCallback
      ) {
        return res.json({
          message:
            "Print confirmation already processed.",

          attendee:
            result.attendee
        });
      }

      res.json({
        message:
          "Badge print confirmed. Attendee checked in.",

        status:
          "CHECKED_IN",

        attendee:
          result.attendee
      });

    } catch (error) {
      console.error(
        "Webhook error:",
        error.message
      );

      res.status(400).json({
        error:
          error.message
      });
    }
  }
);

/*
  ------------------------------------------------
  ORIGINAL RETAIL ROUTES

  Temporarily kept during pivot development.
  These will be removed from the final
  Assignment 2 active application.
  ------------------------------------------------
*/

app.get(
  "/api/inventory",
  (req, res) => {
    try {
      const inventory =
        loadJson(
          inventoryPath
        );

      res.json(
        inventory
      );

    } catch (error) {
      res.status(500).json({
        error:
          "Could not load inventory."
      });
    }
  }
);

app.get(
  "/api/transactions",
  (req, res) => {
    try {
      const transactions =
        loadJson(
          transactionsPath
        );

      res.json(
        transactions
      );

    } catch (error) {
      res.status(500).json({
        error:
          "Could not load transactions."
      });
    }
  }
);

app.post(
  "/api/sales",
  async (req, res) => {
    let connection;

    try {
      const {
        branchId,
        sku,
        quantitySold
      } = req.body;

      const branchesData =
        loadJson(
          branchesPath
        );

      const inventoryData =
        loadJson(
          inventoryPath
        );

      const branches =
        Array.isArray(
          branchesData
        )
          ? branchesData
          : branchesData.branches;

      const inventory =
        Array.isArray(
          inventoryData
        )
          ? inventoryData
          : inventoryData.products;

      const branch =
        branches.find(
          (item) =>
            item.branchId ===
            branchId
        );

      if (!branch) {
        return res
          .status(400)
          .json({
            error:
              "Unknown branch."
          });
      }

      const product =
        inventory.find(
          (item) =>
            item.sku === sku
        );

      if (!product) {
        return res
          .status(400)
          .json({
            error:
              "Unknown product."
          });
      }

      const quantity =
        Number(
          quantitySold
        );

      if (
        !Number.isInteger(
          quantity
        ) ||
        quantity <= 0
      ) {
        return res
          .status(400)
          .json({
            error:
              "Quantity must be a positive whole number."
          });
      }

      const saleEvent = {
        eventId:
          `SALE-${crypto.randomUUID()}`,

        eventType:
          "SALE_COMPLETED",

        branchId,

        receiptNumber:
          `RCPT-${Date.now()}`,

        sku,

        quantitySold:
          quantity,

        unitPrice:
          product.unitPrice,

        timestamp:
          new Date()
            .toISOString()
      };

      connection =
        await amqp.connect(
          RABBITMQ_URL
        );

      const channel =
        await connection
          .createConfirmChannel();

      await channel.assertExchange(
        EXCHANGE,
        "direct",
        {
          durable: true
        }
      );

      await channel.assertExchange(
        DLX,
        "direct",
        {
          durable: true
        }
      );

      await channel.assertQueue(
        QUEUE,
        {
          durable: true,

          arguments: {
            "x-dead-letter-exchange":
              DLX,

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
          JSON.stringify(
            saleEvent
          )
        ),

        {
          persistent: true,
          contentType:
            "application/json"
        }
      );

      await channel
        .waitForConfirms();

      await channel.close();

      res.status(202).json({
        message:
          "Sale event accepted by RabbitMQ.",

        event:
          saleEvent
      });

    } catch (error) {
      console.error(
        "Sale API error:",
        error.message
      );

      res.status(500).json({
        error:
          "Failed to send sale event to RabbitMQ."
      });

    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }
);

/*
  ------------------------------------------------
  START SERVER
  ------------------------------------------------
*/

app.listen(
  PORT,
  () => {
    console.log(
      `API server running on port ${PORT}`
    );

    startConsumer();

    startPrinterSimulator()
      .catch(
        (error) => {
          console.error(
            "Printer simulator failed:",
            error.message
          );
        }
      );
  }
);