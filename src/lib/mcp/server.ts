// D-0010 "Feelings Layer" probe: MCP server exposing the graph as two read-only tools for any
// MCP-capable agent. Route taken: the REAL @modelcontextprotocol/sdk (v1.29), not a hand-rolled
// JSON-RPC handshake — it installed cleanly (67 packages) and its
// WebStandardStreamableHTTPServerTransport speaks plain Web-standard Request/Response, which is an
// exact fit for a Next.js App Router route handler (verified with a standalone smoke script before
// wiring the route: POST initialize / tools/list / tools/call all round-trip through
// transport.handleRequest(request) with zero Node-http shimming needed). Server runs STATELESS
// (sessionIdGenerator: undefined) — the SDK requires a fresh Server+transport per request in that
// mode ("Stateless transport cannot be reused across requests"), which fits a serverless route
// handler naturally: src/app/api/mcp/route.ts calls createMcpServer() + a fresh transport on every
// POST. Low-level `Server` (not the zod-based `McpServer` helper) is used deliberately: tool
// schemas here are plain JSON Schema objects, so this adds no new direct dependency on zod (only
// present today as the SDK's own transitive dependency).
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { listGraphHotels, getGraphHotel, DEFAULT_LIMIT, MAX_LIMIT } from "@/lib/graph/hotels";

export const MCP_SERVER_NAME = "got-cosy-graph";
export const MCP_SERVER_VERSION = "1.0.0";

export const MCP_TOOLS = [
  {
    name: "find_cosy_hotels",
    description:
      "Find live, cosy-scored hotels from Got Cosy's cosiness index (gotcosy.com): hotels scored 0-10 for warmth, intimacy and character from photos and reviews. Only returns hotels that clear the public floor (score 5.0+). Optionally filter by city, country and a minimum cosy score.",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name, e.g. \"Paris\"" },
        country: { type: "string", description: "Country name, e.g. \"France\"" },
        min_score: { type: "number", description: "Minimum cosy score 0-10 (the public floor is 5.0 regardless of this value)" },
        limit: { type: "number", description: `Max results (default ${DEFAULT_LIMIT}, max ${MAX_LIMIT})` },
      },
    },
  },
  {
    name: "get_hotel_feeling",
    description:
      "Get one hotel's cosy score, evidence signals and description from Got Cosy, by its slug (as returned in find_cosy_hotels' results, or from a gotcosy.com/en/hotels/<slug> URL). Below-floor hotels return {below_bar:true} with no score exposed.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", description: "The hotel's Got Cosy slug" } },
      required: ["slug"],
    },
  },
] as const;

/** Builds a fresh MCP Server wired to the two graph tools. Called once per HTTP request by the
 *  route handler — stateless mode requires a new Server+transport per request (see file header). */
export function createMcpServer(): Server {
  const server = new Server(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: MCP_TOOLS as unknown as Array<Record<string, unknown>> }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params;
    const args = (rawArgs || {}) as Record<string, unknown>;
    try {
      if (name === "find_cosy_hotels") {
        const result = await listGraphHotels({
          city: typeof args.city === "string" ? args.city : undefined,
          country: typeof args.country === "string" ? args.country : undefined,
          minScore: typeof args.min_score === "number" ? args.min_score : undefined,
          limit: typeof args.limit === "number" ? args.limit : DEFAULT_LIMIT,
        });
        if (!result) return { content: [{ type: "text", text: JSON.stringify({ error: "graph_unavailable" }) }], isError: true };
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
      if (name === "get_hotel_feeling") {
        const slug = typeof args.slug === "string" ? args.slug : "";
        const result = await getGraphHotel(slug);
        if (result === null) return { content: [{ type: "text", text: JSON.stringify({ error: "graph_unavailable" }) }], isError: true };
        if (result === "not_found") return { content: [{ type: "text", text: JSON.stringify({ error: "not_found" }) }], isError: true };
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
      return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  });

  return server;
}
