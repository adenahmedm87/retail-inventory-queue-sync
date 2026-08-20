## Assignment 1 – Independent Learning Mini-Prototype

**Unfamiliar Tool:** RabbitMQ Message Queues

This is the working mini-prototype created for Assignment 1 before the Day 4 pivot.

### Live Working Prototype

https://assignment-one-rabbitmq-prototype.onrender.com

> The free Render service may take about 50 seconds to start after a period of inactivity.

### Preserved Assignment 1 Version

- GitHub Tag: `assignment-1-rabbitmq-prototype`
- Deployment Branch: `assignment-1-live`
- Final Pre-Pivot Commit: `d17b496`

### What the Prototype Demonstrates

The prototype uses RabbitMQ to process retail sale events asynchronously and update inventory.

Flow:

`POS Dashboard → Express API → RabbitMQ → Inventory Consumer → Inventory Update`

The Assignment 1 version is preserved separately so that the later Meridian Pivot work does not overwrite the original unfamiliar-tool prototype.

### Learning Evidence

The repository also contains the Learning & Blocker Journal documenting errors, troubleshooting steps, resources consulted, and solutions discovered while learning RabbitMQ.

# Retail Inventory Queue Sync

A small event-driven inventory synchronization service built with Node.js and RabbitMQ.

The project simulates sales coming from different retail branches. Each POS sale is published as an event to RabbitMQ, and an inventory consumer receives the event and updates the central inventory data.

## Why I Built This

RabbitMQ and message queues were unfamiliar to me before this project.

I wanted to understand how separate systems can communicate without needing both systems to be running at exactly the same time.

For this prototype, a retail branch acts as the producer and the central inventory service acts as the consumer.

## How It Works

```text
Retail POS
   |
   | SALE_COMPLETED event
   v
RabbitMQ Exchange
retail.events
   |
   | routing key: sale.completed
   v
inventory.sales Queue
   |
   v
Inventory Consumer
   |
   +--> Update central inventory
   +--> Record transaction
   +--> Detect low stock
   +--> Record processed event
```

Failed messages are rejected and routed to a dead-letter queue:

```text
inventory.sales
      |
      | failed message
      v
retail.dlx
      |
      v
inventory.sales.dlq
```

## Features

- RabbitMQ direct exchange and durable queues
- Persistent sale messages
- Manual message acknowledgements
- Publisher confirms
- Sale event validation
- Duplicate event protection
- Central inventory updates
- Transaction audit logging
- Low-stock detection
- Dead-letter queue for failed messages
- Multiple retail branch support
- Command-line POS sale simulation

## Example Branches

The prototype includes different retail sources such as:

- Nairobi CBD
- Westlands
- Nyali
- Kenya Online Store

## Running the Project

Install dependencies:

```bash
npm install
```

RabbitMQ must be running locally.

Start the inventory consumer:

```bash
node src/consumer.js
```

In another terminal, publish a sale:

```bash
node src/producer.js NBO-WST-02 TSH-BLU-M 3
```

The command follows this structure:

```text
node src/producer.js <branchId> <sku> <quantity>
```

For example:

```bash
node src/producer.js MSA-NYK-01 HD-GRY-L 2
```

This represents the Nyali branch selling 2 grey hoodies.

## Example Result

A successful sale can produce an inventory update like:

```text
previousQuantity: 8
quantitySold: 2
newQuantity: 6
reorderLevel: 6
lowStock: true
```

The message is then recorded as processed and acknowledged.

## Reliability

The prototype includes several reliability mechanisms.

### Manual Acknowledgements

The consumer only acknowledges a message after processing succeeds.

### Duplicate Protection

Processed event IDs are stored so the same sale event is not applied twice.

### Dead-Letter Queue

Invalid or failed events are rejected from the main queue and sent to:

```text
inventory.sales.dlq
```

### Publisher Confirms

The producer uses a RabbitMQ confirm channel and waits for RabbitMQ to confirm the message before closing the connection.

## Project Structure

```text
data/
  branches.json
  inventory.json
  processedEvents.json
  transactions.json

docs/
  architecture.md

journal/
  learning-log.md

src/
  consumer.js
  producer.js
  eventValidator.js
  inventoryStore.js
  processedEventStore.js
  transactionStore.js
```

## Learning Journal

My learning process, blockers, tests, errors, and fixes are documented in:

```text
journal/learning-log.md
```

## Current Limitation

This is a learning prototype and uses JSON files as local storage instead of a production database.

The inventory update, transaction log, and processed-event record are separate file operations, so they are not one atomic database transaction.

For a production system, I would use a database and stronger transactional guarantees.