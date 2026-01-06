/**
 * Simple logging utility for the server.
 * Provides structured logging with timestamps.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatMessage(level: LogLevel, message: string, context?: Record<string, unknown>): string {
  const timestamp = formatTimestamp();
  const contextStr = context ? ` ${JSON.stringify(context)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
}

export const log = {
  debug(message: string, context?: Record<string, unknown>): void {
    console.debug(formatMessage("debug", message, context));
  },

  info(message: string, context?: Record<string, unknown>): void {
    console.info(formatMessage("info", message, context));
  },

  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(formatMessage("warn", message, context));
  },

  error(message: string, context?: Record<string, unknown>): void {
    console.error(formatMessage("error", message, context));
  },
};
