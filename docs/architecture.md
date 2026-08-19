# Retail Inventory Queue Sync - Architecture

## Problem

A retail business can have sales happening at different store branches.

When an item is sold, the central inventory should be updated without someone manually editing the stock quantity.

This project simulates that process using RabbitMQ as the message broker between the sales side and the inventory side.

## Main Flow

Branch Sale / POS Simulator
        |
        | publishes SALE_COMPLETED event
        v
RabbitMQ Exchange
        |
        v
inventory.sales queue
        |
        v
Inventory Consumer
        |
        | validates sale
        | checks duplicate event
        | updates stock
        | records transaction
        v
Central Inventory Data

## Components

### 1. Sale Producer

Simulates a sale from a retail branch.

It creates a sale event containing information such as:

- event ID
- branch
- receipt number
- product SKU
- quantity sold
- unit price
- timestamp

The producer does not update inventory directly.

Its responsibility is only to publish the sale event.

### 2. RabbitMQ

RabbitMQ acts as the message broker.

It receives sale events and holds them until the inventory consumer is ready to process them.

Planned exchange:

`retail.events`

Planned queue:

`inventory.sales`

Planned routing key:

`sale.completed`

### 3. Inventory Consumer

The consumer receives sale events from RabbitMQ.

Before updating stock it will:

1. validate the event
2. confirm the SKU exists
3. confirm quantity sold is valid
4. check whether the event was already processed
5. check whether enough stock exists

If processing succeeds, the consumer updates inventory and acknowledges the RabbitMQ message.

### 4. Inventory Store

The first version will use JSON data so the message queue logic remains the main learning focus.

Each product will contain fields such as:

- SKU
- name
- category
- size
- price
- current quantity
- reorder level

### 5. Transaction Audit

Successful inventory updates will also create a transaction record.

This makes it possible to see why stock changed instead of only seeing the final quantity.

## Reliability Features

The project will gradually add:

- manual RabbitMQ acknowledgements
- durable queue
- persistent messages
- duplicate event protection
- input validation
- error handling
- low-stock detection
- transaction audit records

## Initial Scope

The first working version will simulate sales from multiple retail branches and synchronize those sale events into one central inventory.

A web interface is not required for the first version.

The main technical goal is reliable asynchronous data synchronization.