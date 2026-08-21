# Scope Delta Analysis – Meridian Pivot

## Project

**Client:** Solstice Events Co.  
**Final Product:** Event Check-In Kiosk  
**Pivot Technology:** RabbitMQ message queue + webhook callback

---

## 1. Starting Point Before the Pivot

Before the Day 4 pivot, I had completed an individual RabbitMQ mini-prototype for Assignment 1.

That prototype was a retail inventory synchronization system.

Its main flow was:

`POS → Express API → RabbitMQ → Consumer → Inventory Update`

The prototype helped me learn and test:

- RabbitMQ exchanges and queues;
- producers and consumers;
- durable queues;
- persistent messages;
- manual acknowledgements;
- publisher confirms;
- duplicate-event protection;
- dead-letter queues;
- validation;
- asynchronous processing.

The Assignment 1 version was preserved separately using:

- Git tag: `assignment-1-rabbitmq-prototype`
- deployment branch: `assignment-1-live`

This allowed the original unfamiliar-tool prototype to remain available while the main branch was refactored for the pivot.

---

## 2. Client Requirement Before the Change

The Solstice Events check-in requirement involved staff scanning attendee QR codes.

The original badge-print process expected a synchronous vendor API:

`QR Scan → REST Badge Printer → Wait for Print Success → Checked In`

The attendee should only be shown as checked in after the badge was successfully printed.

Duplicate scans also had to be prevented so that an already checked-in attendee would not receive a second badge.

---

## 3. Mid-Sprint Pivot

The client announced that the synchronous badge-printer API was being deprecated.

The replacement architecture had to:

- publish badge-print requests to the vendor message queue;
- process printing asynchronously;
- expose a webhook endpoint for print-completion callbacks;
- show an attendee as pending while waiting for print confirmation;
- mark the attendee as checked in only after webhook confirmation;
- continue preventing duplicate badge requests;
- remain correct when confirmations arrive out of order.

The deadline did not change.

---

# 4. Scope Delta

## Dropped / Deprecated

### Synchronous badge-printer REST dependency

The final application does not wait for a synchronous vendor print response.

The synchronous model:

`Scan → REST call → wait → Checked In`

was replaced with asynchronous messaging.

### Original retail runtime

The retail inventory routes and inventory consumer were removed from the active Assignment 2 application.

Removed from the active pivot server:

- `/api/sales`
- `/api/inventory`
- `/api/transactions`
- retail inventory consumer startup

The retail prototype itself was not destroyed. It remains preserved in GitHub as the Assignment 1 tag and deployment branch.

---

## Modified

### Check-in state handling

Originally, successful printing would immediately determine whether the user could be shown as checked in.

The new system uses explicit states:

`NOT_CHECKED_IN`

↓

`PENDING_PRINT`

↓

`CHECKED_IN`

An attendee is not considered checked in merely because the QR code was scanned.

### Duplicate protection

Duplicate protection was changed to consider asynchronous state.

A second scan is rejected when the attendee is either:

- `PENDING_PRINT`, or
- `CHECKED_IN`.

This prevents a second badge request while the first badge is still printing.

### Completion matching

Print completion is no longer tied to request order.

Each request receives a unique:

`printJobId`

The webhook uses this value to locate the correct attendee.

This allows confirmations to arrive in a different order from the QR scans.

---

## Added

### RabbitMQ badge-print queue

A dedicated asynchronous print flow was added:

- Exchange: `solstice.events`
- Queue: `badge.print.requests`
- Routing key: `badge.print.requested`

Badge-print messages are persistent and are published using RabbitMQ publisher confirmation.

### Print job identifier

Every badge request receives a unique `printJobId`.

Example structure:

`PRINT-<UUID>`

The ID travels from the check-in service through RabbitMQ and back through the webhook callback.

### Pending print state

Immediately after a valid QR scan, the attendee enters:

`PENDING_PRINT`

The UI therefore reflects that printing is still in progress.

### Webhook endpoint

The application now exposes:

`POST /webhooks/print-completed`

The endpoint receives the completed `printJobId`.

Only the matching pending print job can move an attendee to:

`CHECKED_IN`

### Duplicate webhook protection

A webhook that has already been processed does not check the attendee in again.

The service returns:

`Print confirmation already processed.`

This makes repeated callbacks safe.

### Out-of-order callback handling

Callbacks are matched using `printJobId` rather than queue or scan order.

During testing:

1. ATT-003 was scanned first.
2. ATT-002 was scanned second.
3. ATT-003 was given a 4000 ms simulated print delay.
4. ATT-002 was given a 500 ms simulated print delay.
5. ATT-002 completed first.
6. ATT-003 completed afterward.

Both attendees were updated correctly.

### Printer simulator

A printer simulator was added to represent the external badge-print vendor.

It:

1. consumes print requests from RabbitMQ;
2. simulates badge-printing time;
3. sends an HTTP callback to the application's webhook;
4. acknowledges the RabbitMQ message after successful callback processing.

### RabbitMQ failure rollback

A failure case was added for situations where the attendee has been placed into `PENDING_PRINT` but publishing to RabbitMQ fails.

The service rolls the attendee back to:

`NOT_CHECKED_IN`

instead of leaving the attendee permanently stuck in pending state.

### Solstice Events kiosk interface

The previous retail dashboard was replaced on the pivot application's main branch with a Solstice Events check-in kiosk.

The interface shows:

- service status;
- the asynchronous architecture;
- three test attendees;
- QR identifiers;
- `Not Checked In`;
- `Pending Badge Print`;
- `Checked In`;
- active or completed print-job information.

The browser automatically refreshes attendee status while webhook processing happens on the backend.

---

# 5. Regression and Functional Testing

The following tests were completed after the pivot.

## Test 1 – Valid QR scan

Input:

`SOLSTICE-ATT-001`

Result:

`PENDING_PRINT`

A RabbitMQ badge-print message was created.

**Result: PASS**

---

## Test 2 – Webhook completion

The correct `printJobId` was sent to the print-completion webhook.

Result:

`PENDING_PRINT → CHECKED_IN`

**Result: PASS**

---

## Test 3 – Duplicate attendee scan

A checked-in attendee was scanned again.

Result:

`Attendee has already been scanned.`

No second badge request was created.

**Result: PASS**

---

## Test 4 – Duplicate webhook

The same completed print callback was submitted twice.

Result:

`Print confirmation already processed.`

The attendee remained correctly checked in.

**Result: PASS**

---

## Test 5 – Out-of-order callbacks

ATT-003 was scanned before ATT-002.

The simulated delays were:

- ATT-003: 4000 ms
- ATT-002: 500 ms

ATT-002 completed before ATT-003 even though it was scanned later.

Both records were updated correctly using their individual `printJobId` values.

**Result: PASS**

---

## Test 6 – Automatic queue-to-webhook flow

A QR scan created a RabbitMQ message.

The printer simulator consumed the message and automatically called:

`POST /webhooks/print-completed`

The attendee changed to `CHECKED_IN` without manually sending the callback.

**Result: PASS**

---

## Test 7 – Kiosk UI

From the browser:

1. attendee initially displayed `Not Checked In`;
2. Scan QR was pressed;
3. attendee displayed `Pending Badge Print`;
4. printer simulator processed the RabbitMQ request;
5. webhook confirmation arrived;
6. attendee displayed `Checked In`.

**Result: PASS**

---

# 6. Architectural Trade-Offs

## JSON file storage

The prototype stores attendee state in a JSON file instead of a production database.

This was sufficient for the time-boxed demonstration but has limitations:

- file writes are not appropriate for high concurrency;
- application instances would not share state safely;
- deployed ephemeral files may be reset after redeployment or restart.

A production version should use a persistent transactional database.

## Printer simulation

The badge printer is simulated inside the prototype because there is no real vendor printer service available.

The simulation still preserves the important architecture:

`RabbitMQ request → printer consumer → HTTP webhook callback`

A production implementation would replace the simulator with the actual vendor service.

## UI status refresh

The browser periodically requests current attendee status.

The browser polling does not replace the webhook.

The server's status changes only when the print-completion webhook is processed.

For a larger production system, Server-Sent Events or WebSockets could provide real-time browser updates.

---

# 7. Reprioritized Backlog

## Completed for the deadline

- RabbitMQ asynchronous badge-print queue
- three test attendees
- unique print job IDs
- pending status
- webhook callback
- checked-in status after confirmation
- duplicate-scan protection
- duplicate-callback protection
- out-of-order callback handling
- queue-publish rollback
- automatic printer simulator
- Solstice check-in kiosk
- Assignment 1 preservation
- Learning & Blocker Journal
- Scope Delta Analysis

## Deferred beyond the prototype

- production database;
- webhook authentication/signature verification;
- real QR camera/scanner integration;
- real external badge-printer vendor integration;
- user authentication;
- admin management;
- production monitoring and alerting;
- persistent audit database;
- multi-instance concurrency controls.

---

# 8. Final Architecture

`Solstice Kiosk`

↓

`POST /api/checkin`

↓

`PENDING_PRINT`

↓

`RabbitMQ badge.print.requests`

↓

`Badge Printer Simulator`

↓

`POST /webhooks/print-completed`

↓

`printJobId validation`

↓

`CHECKED_IN`

The final application satisfies the pivot by separating the QR scan from badge-print completion and using asynchronous messaging plus webhook confirmation while preserving duplicate protection and correctness when callbacks arrive out of order.