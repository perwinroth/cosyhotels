// D-0010 "Feelings Layer" probe: llms.txt / llms-full.txt regression suite. Site-wide copy law
// (cosyhotels/.claude/skills/copywriting/SKILL.md; founder rule 2026-07-08): no em dashes anywhere
// reader-facing, "honest(ly)" max once per piece, prefer zero. Node built-in runner: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const EM_DASH = "—";

function read(rel: string): string {
  return fs.readFileSync(path.join(__dirname, "..", "public", rel), "utf8");
}

test("public/llms.txt exists and is non-empty", () => {
  const text = read("llms.txt");
  assert.ok(text.length > 100);
});

test("public/llms-full.txt exists and is non-empty", () => {
  const text = read("llms-full.txt");
  assert.ok(text.length > 100);
});

test("llms.txt follows the llms.txt convention: H1 title then a blockquote summary", () => {
  const text = read("llms.txt");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  assert.ok(lines[0].startsWith("# "), "first non-empty line should be an H1");
  assert.ok(lines[1].startsWith(">"), "second non-empty line should be a blockquote summary");
});

test("llms.txt points at the graph endpoints and the MCP endpoint", () => {
  const text = read("llms.txt");
  assert.ok(text.includes("/api/graph/hotels"));
  assert.ok(text.includes("/api/graph/hotel/"));
  assert.ok(text.includes("/api/mcp"));
});

test("llms.txt and llms-full.txt contain no em dashes", () => {
  for (const file of ["llms.txt", "llms-full.txt"]) {
    const text = read(file);
    assert.equal(text.includes(EM_DASH), false, `${file} contains an em dash`);
  }
});

test("llms.txt and llms-full.txt use \"honest\" at most once each (copy law: prefer zero)", () => {
  for (const file of ["llms.txt", "llms-full.txt"]) {
    const text = read(file);
    const count = (text.match(/honest/gi) || []).length;
    assert.ok(count <= 1, `${file} uses "honest" ${count} times`);
  }
});

test("public/mcp.json exists, is valid JSON, and names both tools", () => {
  const text = read("mcp.json");
  const json = JSON.parse(text);
  const names = (json.tools || []).map((t: { name: string }) => t.name);
  assert.deepEqual(names.sort(), ["find_cosy_hotels", "get_hotel_feeling"]);
});
