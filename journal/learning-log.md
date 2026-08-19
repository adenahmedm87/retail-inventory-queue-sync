# Learning & Build Log

## Project
Retail Inventory Queue Sync

## Technology Being Learned
RabbitMQ / Message Queues

---

## Session 1 - Environment Setup

**Date:** 18 August 2026  
**Start time:** 9:57 AM

### Goal

Prepare my computer and repository so I can build and test a RabbitMQ-based inventory syncing service.

### Starting Knowledge

Before this project, I had not used RabbitMQ or message queues.

I already understood the basic idea of APIs and webhooks, where one system can send data to another system.

What was new to me was having a message broker between two applications and allowing messages to wait in a queue until another application is ready to process them.

### Work Completed

- Created my GitHub repository.
- Installed Git.
- Installed VS Code.
- Installed Node.js and npm.
- Initialized the Node.js project.
- Installed the `amqplib` RabbitMQ client library.
- Installed Erlang and RabbitMQ.
- Enabled and opened the RabbitMQ Management UI.
- Confirmed RabbitMQ is listening for AMQP connections on port `5672`.
- Confirmed the Management UI is available on port `15672`.

### Blocker Encountered

When I first ran:

`rabbitmqctl.bat status`

the RabbitMQ CLI could reach the RabbitMQ node but authentication failed.

The diagnostic message said the Erlang cookie used by the CLI might not match the one used by the RabbitMQ Windows service.

### Investigation

I checked the RabbitMQ diagnostic output instead of reinstalling the software.

The TCP connection was successful, which showed that RabbitMQ was reachable. The failure was specifically related to Erlang distribution authentication.

### Resolution

I copied the Erlang cookie used by the RabbitMQ Windows service into my Windows user profile and tested the status command again.

After that, `rabbitmqctl.bat status` worked successfully.

### Result

RabbitMQ is now running correctly.

Current RabbitMQ state before building the application:

- Connections: 0
- Queues: 0
- AMQP port: 5672
- Management port: 15672

This is expected because I have not created the producer, consumer, or application queue yet.

### What I Learned

I now understand that installing RabbitMQ is different from installing the Node.js `amqplib` package.

`amqplib` is the library my JavaScript program will use to communicate with RabbitMQ, while RabbitMQ itself is the message broker running as a separate service.

I also learned that RabbitMQ and its command-line tools use an Erlang cookie to authenticate with each other locally.

### Next Step

Build the smallest producer and consumer test and confirm that a message can pass through RabbitMQ.
## Inventory Store Implementation and Test

### Goal
Test the inventory update logic independently before connecting it to RabbitMQ.

### Blocker
The first test failed with `MODULE_NOT_FOUND` because the `src` folder had accidentally been created inside the `data` folder.

### Resolution
I corrected the project structure so that `src` exists at the project root, then recreated `inventoryStore.js` and `testInventoryStore.js`.

### Test Result
I tested SKU `HD-GRY-L`.

- Starting quantity: 8
- Quantity sold: 3
- New quantity: 5
- Reorder level: 6
- Low stock detected: true

The inventory was restored to its original quantity of 8 after testing so the project keeps a clean baseline.

### What I Learned
I learned that file structure affects how Node.js resolves modules, and I confirmed that the inventory logic can read, validate, update, save, and detect low stock before RabbitMQ is introduced.
## RabbitMQ Producer and Consumer Test

### Goal
Test the complete asynchronous inventory sync flow using RabbitMQ.

### Implementation
I created a producer that publishes `SALE_COMPLETED` events to the `retail.events` exchange using the routing key `sale.completed`.

The event is routed to the durable `inventory.sales` queue.

I also created a consumer that reads the queued event, updates inventory using the existing inventory module, and manually acknowledges the message after successful processing.

### Test Result
I published a sale event for SKU `TSH-BLU-M` with a quantity sold of 2.

Before the consumer started, RabbitMQ showed one message waiting in the queue.

After starting the consumer:

- Previous quantity: 45
- Quantity sold: 2
- New quantity: 43
- Low stock: false
- Message acknowledged successfully

After processing, the RabbitMQ queue returned to zero messages.

I restored the inventory quantity to 45 after the test so the repository keeps a clean baseline.

### What I Learned
I confirmed that RabbitMQ can hold a sale event while the consumer is offline and deliver it when the consumer becomes available.

I also learned how exchanges, routing keys, queues, consumers, persistent messages, and manual acknowledgments work together in an asynchronous message flow.
## Duplicate Event Protection

### Goal
Prevent the same sale event from changing inventory more than once.

### Implementation
I added `data/processedEvents.json` to store processed event IDs and created `src/processedEventStore.js` to read and write those IDs.

The consumer now checks the incoming `eventId` before reducing stock.

If the event has already been processed, the consumer acknowledges it without applying the inventory update again.

### Test Result
I published the same event ID twice:

`SALE-NBO-CBD-0001`

The first event reduced SKU `TSH-BLU-M` from 45 to 43.

After publishing the same event again, the quantity remained 43 instead of dropping to 41.

This confirmed that duplicate-event protection was working.

After testing, I restored the inventory quantity to 45 and reset `processedEvents.json` to an empty list so the repository keeps a clean baseline.

### What I Learned
I learned how idempotency protects a message-driven system from applying the same business event more than once.

A unique event ID allows the consumer to recognize duplicate deliveries and keep inventory data consistent.
## Sale Event Validation

### Goal
Prevent malformed sale events from reaching the inventory update logic.

### Implementation
I created `src/eventValidator.js` and connected it to the RabbitMQ consumer.

The validator checks the required sale-event fields and verifies that values such as `quantitySold` and `unitPrice` are valid before inventory is updated.

### Test Result
I tested an invalid event with:

`quantitySold: -2`

The validator rejected it with:

`quantitySold must be a positive whole number`

I also tested a correctly structured sale event, and the validator returned:

`true`

### What I Learned
I learned that message validation should happen before business logic so malformed events cannot change inventory data.

This adds another reliability layer before duplicate checking, stock updates, and RabbitMQ acknowledgment.
## Transaction Audit Logging

### Goal
Create a permanent audit trail for successful inventory updates.

### Implementation
I added `data/transactions.json` and created `src/transactionStore.js`.

The RabbitMQ consumer now records a transaction after a successful stock update.

Each transaction stores:

- eventId
- branchId
- receiptNumber
- sku
- quantitySold
- previousQuantity
- newQuantity
- lowStock status
- recordedAt timestamp

### Blocker
During the first transaction test, the sale event was processed but `transactions.json` remained empty.

I checked the running Node.js processes and discovered that two `consumer.js` processes were running at the same time.

An older consumer process was able to receive the RabbitMQ message before the newer consumer containing the transaction-logging code.

### Resolution
I stopped both Node.js consumer processes and restarted only the latest consumer.

I then tested with a new event ID: `SALE-NBO-CBD-0003`.

### Test Result
The consumer successfully:

- updated inventory
- recorded the transaction
- recorded the event as processed
- acknowledged the RabbitMQ message

The transaction record showed:

- Previous quantity: 41
- Quantity sold: 2
- New quantity: 39
- Low stock: false

After testing, I restored the inventory and reset the transaction and processed-event files to their clean baseline.

### What I Learned
I learned that multiple consumers on the same RabbitMQ queue can compete for messages.

I also learned how an audit log helps trace exactly which sale event changed inventory and when the change occurred.
## Dead-Letter Queue

### Goal
Preserve failed RabbitMQ messages so invalid sale events are not lost.

### Implementation
I added a dead-letter exchange and queue:

- Exchange: `retail.dlx`
- Queue: `inventory.sales.dlq`
- Routing key: `sale.failed`

The main `inventory.sales` queue now routes rejected messages to the dead-letter queue.

### Blocker
RabbitMQ returned `406 PRECONDITION_FAILED` because the existing `inventory.sales` queue had been created with different arguments.

I also found that `producer.js` still contained an older `assertQueue` declaration using only `{ durable: true }`, which conflicted with the new dead-letter configuration.

### Resolution
I stopped the running consumer, deleted the existing `inventory.sales` queue, and allowed the updated consumer to recreate it with the dead-letter settings.

I also removed the old duplicate `assertQueue` declaration from `producer.js`.

### Test Result
I published an intentionally invalid event:

- Event ID: `SALE-NBO-CBD-DLQ-0001`
- Quantity sold: `-2`

The consumer rejected it with:

`quantitySold must be a positive whole number`

RabbitMQ then showed one message waiting in:

`inventory.sales.dlq`

This confirmed that the failed message was preserved instead of being lost.

### What I Learned
I learned that RabbitMQ queue arguments must remain consistent with the configuration used when the queue was created.

I also learned how dead-letter queues provide a safe location for failed messages that need investigation or recovery.
