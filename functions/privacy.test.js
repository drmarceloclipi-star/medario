"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { unmatchedSearchLogMessage } = require("./privacy");

test("unmatched search logging omits raw health text", () => {
  const rawQuery = "dor no peito e falta de ar";
  const message = unmatchedSearchLogMessage();

  assert.equal(message.includes(rawQuery), false);
  assert.equal(message.includes("query \""), false);
  assert.match(message, /raw query omitted/);
});
