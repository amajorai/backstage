import { initTracing } from "./tracing.js";

initTracing();

import { auth } from "@backstage/auth";
import { env } from "@backstage/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { posthog } from "./lib/posthog.js";
import { otelMiddleware } from "./middleware/otel.js";
import { otelLoggerMiddleware } from "./middleware/otel-logger.js";

const app = new Hono();

app.use(logger());
app.use(otelMiddleware);
app.use(otelLoggerMiddleware);
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.get("/", (c) => {
  return c.text("OK");
});

app.onError((err, c) => {
  posthog?.captureException(err);
  return c.json({ error: "Internal Server Error" }, 500);
});

export default app;
