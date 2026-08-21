const express = require("express");
const cors = require("cors");
const path = require("path");

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
  ATTENDEES
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
  QR CHECK-IN

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

      const {
        attendee,
        printJobId
      } = prepareCheckIn(
        qrCode
      );

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
  PRINT COMPLETION WEBHOOK

  Printer finishes
      ↓
  Webhook receives printJobId
      ↓
  Match active print job
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
  START SOLSTICE SERVICE
  ------------------------------------------------
*/

app.listen(
  PORT,
  () => {
    console.log(
      `Solstice check-in service running on port ${PORT}`
    );

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