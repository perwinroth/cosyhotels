// Natural-phrase search: the coreQuery stripper that lets "cosy hotels in sweden" resolve to
// "sweden" on retry. Pure-function tests; the DB paths are covered by the live contract that
// searchSite retries with the core and inlines country hotels (see src/lib/search.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { coreQuery } from "../src/lib/search";

test("strips our vocabulary and connective filler down to the place", () => {
  assert.equal(coreQuery("cosy hotels in sweden"), "sweden");
  assert.equal(coreQuery("cozy hotel stockholm"), "stockholm");
  assert.equal(coreQuery("best cosy stays in the alps"), "alps");
  assert.equal(coreQuery("cosiest hotels of tuscany"), "tuscany");
});

test("leaves real place and name terms intact", () => {
  assert.equal(coreQuery("sweden"), "sweden");
  assert.equal(coreQuery("new york"), "new york");
  assert.equal(coreQuery("san gimignano"), "san gimignano");
});

test("multi-word remainders keep their order", () => {
  assert.equal(coreQuery("cosy hotels in san gimignano"), "san gimignano");
});

test("all-filler queries strip to empty (caller then keeps the raw result)", () => {
  assert.equal(coreQuery("cosy hotels"), "");
  assert.equal(coreQuery("the best hotel"), "");
});
