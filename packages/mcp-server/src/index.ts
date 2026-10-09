#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  type CallToolResult,
  ListToolsRequestSchema,
  type ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";

import { bridgeClient } from "./bridge-client.js";

const bridge = bridgeClient(
  process.env.BACKSTAGE_API_URL ?? "http://127.0.0.1:37842",
  process.env.BACKSTAGE_API_TOKEN
);

const server = new Server(
  { name: "backstage", version: "0.0.1" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(
  ListToolsRequestSchema,
  async (): Promise<ListToolsResult> => {
    const res = await bridge("/api/tools");
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as ListToolsResult;
  }
);

server.setRequestHandler(
  CallToolRequestSchema,
  async (req): Promise<CallToolResult> => {
    const res = await bridge("/api/tools/call", {
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
