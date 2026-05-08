import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerOTel } = await import("@vercel/otel");

    const token = process.env.AXIOM_TOKEN;
    const dataset = process.env.AXIOM_DATASET;
    const domain = process.env.AXIOM_DOMAIN ?? "api.axiom.co";

    if (!(token && dataset)) return;

    registerOTel({
      serviceName: "backstage-web",
      traceExporter: new OTLPTraceExporter({
        url: `https://${domain}/v1/traces`,
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Axiom-Dataset": dataset,
        },
      }),
    });
  }
}
