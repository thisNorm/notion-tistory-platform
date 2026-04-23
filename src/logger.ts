import type { LogEntry, LogLevel } from "@/types";

export class RunLogger {
  private readonly entries: LogEntry[] = [];

  private push(level: LogLevel, message: string, data?: Record<string, unknown>) {
    this.entries.push({
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    });
  }

  info(message: string, data?: Record<string, unknown>) {
    this.push("info", message, data);
  }

  warn(message: string, data?: Record<string, unknown>) {
    this.push("warn", message, data);
  }

  error(message: string, data?: Record<string, unknown>) {
    this.push("error", message, data);
  }

  flush(): LogEntry[] {
    return [...this.entries];
  }
}

export function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "알 수 없는 오류";
  }
}
