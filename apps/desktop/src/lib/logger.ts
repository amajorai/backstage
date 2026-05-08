import { Axiom } from "@axiomhq/js";
import { AxiomJSTransport, Logger as AxiomLogger } from "@axiomhq/logging";
import pino from "pino";

const isDev = import.meta.env.DEV;

const _pino = pino({
  level: isDev ? "debug" : "info",
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          ignore: "pid,hostname",
          translateTime: "SYS:standard",
        },
      }
    : undefined,
});

const AXIOM_TOKEN = import.meta.env.VITE_AXIOM_TOKEN as string | undefined;
const AXIOM_DATASET = import.meta.env.VITE_AXIOM_DATASET as string | undefined;

let axiomLogger: AxiomLogger | null = null;

if (AXIOM_TOKEN && AXIOM_DATASET) {
  const axiom = new Axiom({ token: AXIOM_TOKEN });
  axiomLogger = new AxiomLogger({
    transports: [new AxiomJSTransport({ axiom, dataset: AXIOM_DATASET })],
  });
}

let _loggingEnabled = true;

export function setAxiomLoggingEnabled(enabled: boolean) {
  _loggingEnabled = enabled;
}

export function logToAxiom(
  level: "debug" | "info" | "warn" | "error",
  message: string,
  data?: Record<string, unknown>
) {
  if (!(axiomLogger && _loggingEnabled)) return;
  axiomLogger[level](message, data ?? {});
}

type LogLevel = "debug" | "info" | "warn" | "error";

function serializeForAxiom(
  data: Record<string, unknown>
): Record<string, unknown> {
  if (data.err instanceof Error) {
    return {
      ...data,
      err: {
        message: data.err.message,
        stack: data.err.stack,
        name: data.err.name,
      },
    };
  }
  return data;
}

function makeMethod(level: LogLevel) {
  return (...args: unknown[]) => {
    (_pino[level] as (...a: unknown[]) => void)(...args);
    if (typeof args[0] === "string") {
      logToAxiom(level, args[0]);
    } else if (typeof args[0] === "object" && args[0] !== null) {
      const message = typeof args[1] === "string" ? args[1] : "";
      logToAxiom(
        level,
        message,
        serializeForAxiom(args[0] as Record<string, unknown>)
      );
    }
  };
}

export const logger = {
  debug: makeMethod("debug"),
  info: makeMethod("info"),
  warn: makeMethod("warn"),
  error: makeMethod("error"),
};
