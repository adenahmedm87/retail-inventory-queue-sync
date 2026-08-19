const fs = require("fs");
const path = require("path");

const processedEventsPath = path.join(
  __dirname,
  "..",
  "data",
  "processedEvents.json"
);

function loadProcessedEvents() {
  const rawData = fs.readFileSync(
    processedEventsPath,
    "utf8"
  );

  return JSON.parse(rawData);
}

function hasProcessedEvent(eventId) {
  const events = loadProcessedEvents();

  return events.some(
    (event) => event.eventId === eventId
  );
}

function markEventProcessed(eventId) {
  const events = loadProcessedEvents();

  events.push({
    eventId,
    processedAt: new Date().toISOString()
  });

  fs.writeFileSync(
    processedEventsPath,
    JSON.stringify(events, null, 2),
    "utf8"
  );
}

module.exports = {
  loadProcessedEvents,
  hasProcessedEvent,
  markEventProcessed
};