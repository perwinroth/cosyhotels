// D-0010 "Feelings Layer" probe: MCP endpoint (JSON-RPC 2.0 over HTTP, the Streamable HTTP MCP
// transport). Stateless — a fresh Server + transport is created per request (see
// src/lib/mcp/server.ts header for why). Point any MCP-capable agent/client at POST
// https://gotcosy.com/api/mcp; see /llms.txt and public/mcp.json for the connection pointer.
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const server = createMcpServer();
  // enableJsonResponse: true — plain JSON responses (no SSE stream) fit this server's tools, which
  // are quick synchronous reads with no server-initiated notifications to push.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function GET(): Promise<Response> {
  return new Response(
    JSON.stringify({ error: "method_not_allowed", note: "POST JSON-RPC 2.0 requests here (initialize, tools/list, tools/call). See /llms.txt." }),
    { status: 405, headers: { "content-type": "application/json", Allow: "POST" } },
  );
}
