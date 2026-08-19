const fs = require("fs");
const path = require("path");

const transactionsPath = path.join(
  __dirname,
  "..",
  "data",
  "transactions.json"
);

function loadTransactions() {
  const rawData = fs.readFileSync(
    transactionsPath,
    "utf8"
  );

  return JSON.parse(rawData);
}

function recordTransaction(transaction) {
  const transactions = loadTransactions();

  transactions.push({
    ...transaction,
    recordedAt: new Date().toISOString()
  });

  fs.writeFileSync(
    transactionsPath,
    JSON.stringify(transactions, null, 2),
    "utf8"
  );
}

module.exports = {
  loadTransactions,
  recordTransaction
};