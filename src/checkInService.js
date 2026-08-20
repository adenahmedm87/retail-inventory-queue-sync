const crypto = require("crypto");

const {
  findAttendeeByQr,
  updateAttendeeStatus
} = require("./attendeeStore");

function prepareCheckIn(qrCode) {
  const attendee =
    findAttendeeByQr(qrCode);

  if (!attendee) {
    throw new Error(
      "Attendee QR code not found."
    );
  }

  if (
    attendee.status ===
      "PENDING_PRINT" ||
    attendee.status ===
      "CHECKED_IN"
  ) {
    throw new Error(
      "Attendee has already been scanned."
    );
  }

  const printJobId =
    `PRINT-${crypto.randomUUID()}`;

  const updatedAttendee =
    updateAttendeeStatus(
      attendee.attendeeId,
      "PENDING_PRINT",
      printJobId
    );

  return {
    attendee: updatedAttendee,
    printJobId
  };
}

module.exports = {
  prepareCheckIn
};