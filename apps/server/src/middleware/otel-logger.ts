import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import type { MiddlewareHandler } from "hono";

const otelHonoLogger = logs.getLogger("hono");

export const otelLoggerMiddleware: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  const status = c.res.status;

  otelHonoLogger.emit({
    severityNumber:
      status >= 500
        ? SeverityNumber.ERROR
        : status >= 400
          ? SeverityNumber.WARN
          : SeverityNumber.INFO,
    severityText: status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "INFO",
    body: `${c.req.method} ${c.req.path} ${status} ${duration}ms`,
    attributes: {
      "http.method": c.req.method,
      "http.route": c.req.path,
      "http.status_code": status,
      "http.duration_ms": duration,
    },
  });
};
