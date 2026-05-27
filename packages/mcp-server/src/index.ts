import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  type CallToolResult,
  ListToolsRequestSchema,
  type ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";

const BACKSTAGE_URL = process.env.BACKSTAGE_API_URL ?? "http://localhost:37842";

const server = new Server(
  { name: "backstage", version: "0.0.1" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(
  ListToolsRequestSchema,
  async (): Promise<ListToolsResult> => {
    const res = await fetch(`${BACKSTAGE_URL}/api/tools`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as ListToolsResult;
  }
);

server.setRequestHandler(
  CallToolRequestSchema,
  async (req): Promise<CallToolResult> => {
    const res = await fetch(`${BACKSTAGE_URL}/api/tools/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: req.params.name,
        arguments: req.params.arguments ?? {},
      }),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as CallToolResult;
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
