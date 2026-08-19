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