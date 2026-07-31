/**
 * Discovery Engine — logger.
 *
 * Deliberately minimal: this is a single-admin, server-side tool, not
 * a distributed system. No log shipping, no levels config, no
 * external dependency — just consistently-prefixed console output so
 * mission runs are greppable, plus an in-memory buffer the admin UI
 * can read back after a run finishes.
 */

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  at: string; // ISO timestamp
  data?: unknown;
}

export class MissionLogger {
  private readonly entries: LogEntry[] = [];

  constructor(private readonly missionId: string) {}

  private push(level: LogLevel, message: string, data?: unknown) {
    const entry: LogEntry = { level, message, at: new Date().toISOString(), data };
    this.entries.push(entry);

    const prefix = `[discovery:${this.missionId}]`;
    if (level === "error") console.error(prefix, message, data ?? "");
    else if (level === "warn") console.warn(prefix, message, data ?? "");
    else console.log(prefix, message, data ?? "");
  }

  info(message: string, data?: unknown) {
    this.push("info", message, data);
  }

  warn(message: string, data?: unknown) {
    this.push("warn", message, data);
  }

  error(message: string, data?: unknown) {
    this.push("error", message, data);
  }

  /** Read-only snapshot for the admin UI's mission log panel. */
  getEntries(): readonly LogEntry[] {
    return this.entries;
  }
}
