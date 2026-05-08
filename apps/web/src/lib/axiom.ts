"use client";

import { Axiom } from "@axiomhq/js";
import { AxiomJSTransport, Logger } from "@axiomhq/logging";
import { createUseLogger, createWebVitalsComponent } from "@axiomhq/react";

const token = process.env.NEXT_PUBLIC_AXIOM_TOKEN;
const dataset = process.env.NEXT_PUBLIC_AXIOM_DATASET;

let logger: Logger;
let useLogger: ReturnType<typeof createUseLogger>;
let WebVitals: ReturnType<typeof createWebVitalsComponent>;

if (token && dataset) {
  const axiom = new Axiom({ token });
  logger = new Logger({
    transports: [new AxiomJSTransport({ axiom, dataset })],
  });
  useLogger = createUseLogger(logger);
  WebVitals = createWebVitalsComponent(logger);
}

export { logger, useLogger, WebVitals };
