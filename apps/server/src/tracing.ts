import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

export function initTracing() {
  const token = process.env.AXIOM_TOKEN;
  const dataset = process.env.AXIOM_DATASET;
  const domain = process.env.AXIOM_DOMAIN ?? "api.axiom.co";

  if (!(token && dataset)) {
    return;
  }

  const traceExporter = new OTLPTraceExporter({
    url: `https://${domain}/v1/traces`,
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Axiom-Dataset": dataset,
    },
  });

  const logsDataset = process.env.AXIOM_LOGS_DATASET ?? dataset;
  const logExporter = new OTLPLogExporter({
    url: `https://${domain}/v1/logs`,
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Axiom-Dataset": logsDataset,
    },
  });

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: "backstage-server",
      [ATTR_SERVICE_VERSION]: "0.1.0",
    }),
    spanProcessors: [new BatchSpanProcessor(traceExporter)],
    logRecordProcessors: [new BatchLogRecordProcessor(logExporter)],
  });

  sdk.start();

  process.on("SIGTERM", () => {
    sdk.shutdown().finally(() => process.exit(0));
  });
}
