const fs = require("fs");
const path = require("path");

const attendeesPath = path.join(
  __dirname,
  "../data/attendees.json"
);

function loadAttendees() {
  const content = fs.readFileSync(
    attendeesPath,
    "utf8"
  );

  return JSON.parse(content);
}

function saveAttendees(attendees) {
  fs.writeFileSync(
    attendeesPath,
    JSON.stringify(
      attendees,
      null,
      2
    )
  );
}

function findAttendeeByQr(qrCode) {
  const attendees =
    loadAttendees();

  return attendees.find(
    (attendee) =>
      attendee.qrCode === qrCode
  );
}

function updateAttendeeStatus(
  attendeeId,
  status,
  activePrintJobId = null
) {
  const attendees =
    loadAttendees();

  const attendee =
    attendees.find(
      (item) =>
        item.attendeeId ===
        attendeeId
    );

  if (!attendee) {
    throw new Error(
      `Attendee not found: ${attendeeId}`
    );
  }

  attendee.status =
    status;

  attendee.activePrintJobId =
    activePrintJobId;

  saveAttendees(
    attendees
  );

  return attendee;
}

function confirmPrintJob(
  printJobId
) {
  const attendees =
    loadAttendees();

  const attendee =
    attendees.find(
      (item) =>
        item.activePrintJobId ===
          printJobId ||
        item.lastCompletedPrintJobId ===
          printJobId
    );

  if (!attendee) {
    throw new Error(
      "Print job does not match any attendee."
    );
  }

  if (
    attendee.status ===
      "CHECKED_IN" &&
    attendee.lastCompletedPrintJobId ===
      printJobId
  ) {
    return {
      attendee,
      duplicateCallback: true
    };
  }

  if (
    attendee.status !==
      "PENDING_PRINT" ||
    attendee.activePrintJobId !==
      printJobId
  ) {
    throw new Error(
      "Print confirmation does not match the active print job."
    );
  }

  attendee.status =
    "CHECKED_IN";

  attendee.checkedInAt =
    new Date().toISOString();

  attendee.lastCompletedPrintJobId =
    printJobId;

  attendee.activePrintJobId =
    null;

  saveAttendees(
    attendees
  );

  return {
    attendee,
    duplicateCallback: false
  };
}

module.exports = {
  loadAttendees,
  findAttendeeByQr,
  updateAttendeeStatus,
  confirmPrintJob
};