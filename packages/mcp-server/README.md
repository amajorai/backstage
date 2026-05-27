# @backstage/mcp-server

MCP server that proxies tool calls from Claude Desktop (and other MCP clients) to the Backstage HTTP bridge running locally on port 37842.

## Build

```bash
cd packages/mcp-server
bun install
bun run build
```

This compiles `src/index.ts` to `dist/index.js`.

## Claude Desktop Configuration

Add to your `claude_desktop_config.json` under `mcpServers`:

```json
{
  "mcpServers": {
    "backstage": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp-server/dist/index.js"]
    }
  }
}
```

Backstage must be running for tool calls to succeed. The server will start but requests will fail until the app is open.

## Environment Variables

- `BACKSTAGE_API_URL` - Override the default bridge URL (`http://localhost:37842`). Useful if Backstage is configured to use a non-default port.

Example:

```json
{
  "mcpServers": {
    "backstage": {
      "command": "node",
      "args": ["/path/to/dist/index.js"],
      "env": {
        "BACKSTAGE_API_URL": "http://localhost:9000"
      }
    }
  }
}
```
