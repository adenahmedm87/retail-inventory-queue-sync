const {
  findProductBySku,
  reduceStock
} = require("./inventoryStore");

const testSku = "HD-GRY-L";

console.log("Before sale:");
console.log(findProductBySku(testSku));

console.log("\nApplying sale of 3 units...");

const result = reduceStock(testSku, 3);

console.log("\nUpdate result:");
console.log(result);

console.log("\nAfter sale:");
console.log(findProductBySku(testSku));