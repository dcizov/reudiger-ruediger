import type { DealLogger } from "../types/deals.js";

function write(
  method: "info" | "warn" | "error",
  message: string,
  context?: Record<string, unknown>
): void {
  if (context && Object.keys(context).length > 0) {
    console[method](message, context);
    return;
  }

  console[method](message);
}

export const dealLogger: DealLogger = {
  info: (message, context) => write("info", message, context),
  warn: (message, context) => write("warn", message, context),
  error: (message, context) => write("error", message, context),
};

export function safeErrorName(error: unknown): string {
  if (error instanceof Error) {
    return error.name || "Error";
  }

  return "UnknownError";
}
