// D-0010 "Feelings Layer" probe: MCP server regression suite. Exercises the ACTUAL
// @modelcontextprotocol/sdk transport (src/lib/mcp/server.ts createMcpServer() +
// WebStandardStreamableHTTPServerTransport, the same objects src/app/api/mcp/route.ts wires up per
// request), not a hand-rolled stand-in — so a real JSON-RPC 2.0 request/response round-trips
// through the same code path production uses. No Supabase secrets are set in this test run (see
// MEASUREMENT.md: "Secrets needed: None"), so tool calls exercise the fail-safe
// graph_unavailable path (getServerSupabase() returns null) rather than live data — that path is
// itself part of the contract (an MCP client must get a clean error, never a crash, if the graph
// is temporarily unavailable). Node built-in runner: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { createMcpServer, MCP_TOOLS } from "../src/lib/mcp/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

// Stateless mode requires a FRESH Server + transport per request (the SDK throws "Stateless
// transport cannot be reused across requests" otherwise) — mirrors exactly what
// src/app/api/mcp/route.ts does on every POST.
async function callMcp(body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  const req = new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify(body),
  });
  const res = await transport.handleRequest(req);
  const json = (await res.json()) as Record<string, unknown>;
  return { status: res.status, json };
}

test("MCP_TOOLS declares exactly find_cosy_hotels and get_hotel_feeling", () => {
  assert.deepEqual(MCP_TOOLS.map((t) => t.name).sort(), ["find_cosy_hotels", "get_hotel_feeling"]);
});

test("initialize handshake returns 200 with server info", async () => {
  const { status, json } = await callMcp({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test-client", version: "1.0" } },
  });
  assert.equal(status, 200);
  const result = json.result as { serverInfo?: { name?: string } };
  assert.equal(result?.serverInfo?.name, "got-cosy-graph");
});

test("tools/list returns exactly the two tools, each with a name/description/inputSchema", async () => {
  const { status, json } = await callMcp({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  assert.equal(status, 200);
  const result = json.result as { tools?: Array<{ name: string; description: string; inputSchema: unknown }> };
  const tools = result?.tools ?? [];
  assert.equal(tools.length, 2);
  assert.deepEqual(tools.map((t) => t.name).sort(), ["find_cosy_hotels", "get_hotel_feeling"]);
  for (const t of tools) {
    assert.ok(t.description && t.description.length > 10);
    assert.ok(t.inputSchema && typeof t.inputSchema === "object");
  }
});

test("tools/call find_cosy_hotels with no arguments round-trips through the JSON-RPC transport (fails safe with no DB configured)", async () => {
  const { status, json } = await callMcp({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "find_cosy_hotels", arguments: {} },
  });
  assert.equal(status, 200);
  const result = json.result as { content?: Array<{ type: string; text: string }>; isError?: boolean };
  assert.ok(Array.isArray(result?.content) && result.content.length === 1);
  assert.equal(result.content[0].type, "text");
  // No Supabase env is set in this test process, so the underlying listGraphHotels() returns null
  // and the tool must report a clean error, never throw out of the handler.
  assert.equal(result.isError, true);
  const payload = JSON.parse(result.content[0].text);
  assert.equal(payload.error, "graph_unavailable");
});

test("tools/call get_hotel_feeling requires a slug and fails safe with no DB configured", async () => {
  const { json } = await callMcp({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "get_hotel_feeling", arguments: { slug: "some-hotel" } },
  });
  const result = json.result as { content?: Array<{ type: string; text: string }>; isError?: boolean };
  assert.equal(result.isError, true);
  const payload = JSON.parse(result.content[0].text);
  assert.equal(payload.error, "graph_unavailable");
});

test("tools/call rejects an unknown tool name", async () => {
  const { json } = await callMcp({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: { name: "delete_everything", arguments: {} },
  });
  const result = json.result as { content?: Array<{ type: string; text: string }>; isError?: boolean };
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /Unknown tool/);
});
