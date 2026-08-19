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