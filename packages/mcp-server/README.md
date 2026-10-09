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
      "args": ["/absolute/path/to/packages/mcp-server/dist/index.js"],
      "env": { "BACKSTAGE_API_TOKEN": "<copy from Backstage Settings>" }
    }
  }
}
```

Backstage must be running for tool calls to succeed. The server will start but requests will fail until the app is open.

## Environment Variables

- `BACKSTAGE_API_TOKEN` - Required bearer token. Copy the authenticated configuration from Backstage Settings; keep it private. The token persists across app restarts in encrypted storage.
- `BACKSTAGE_API_URL` - Override the default bridge URL (`http://127.0.0.1:37842`). Only local HTTP origins are accepted. Useful if Backstage is configured to use a non-default port.

Example:

```json
{
  "mcpServers": {
    "backstage": {
      "command": "node",
      "args": ["/path/to/dist/index.js"],
      "env": {
        "BACKSTAGE_API_URL": "http://127.0.0.1:9000",
        "BACKSTAGE_API_TOKEN": "<copy from Backstage Settings>"
      }
    }
  }
}
```
