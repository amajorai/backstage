import { SpanStatusCode, trace } from "@opentelemetry/api";
import {
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_HTTP_ROUTE,
  ATTR_URL_FULL,
} from "@opentelemetry/semantic-conventions";
import type { MiddlewareHandler } from "hono";

const tracer = trace.getTracer("hono");

export const otelMiddleware: MiddlewareHandler = (c, next) => {
  return tracer.startActiveSpan(
    `${c.req.method} ${c.req.path}`,
    async (span) => {
      span.setAttributes({
        [ATTR_HTTP_REQUEST_METHOD]: c.req.method,
        [ATTR_URL_FULL]: c.req.url,
        [ATTR_HTTP_ROUTE]: c.req.path,
      });

      try {
        await next();
        const status = c.res.status;
        span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, status);
        if (status >= 500) {
          span.setStatus({ code: SpanStatusCode.ERROR });
        }
      } catch (err) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: String(err),
        });
        throw err;
      } finally {
        span.end();
      }
    }
  );
};
