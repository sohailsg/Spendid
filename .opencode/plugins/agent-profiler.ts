import { spawnSync } from "node:child_process";
import path from "node:path";

function pick(obj: any, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj?.[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

function readSessionId(event: any): string | undefined {
  return (
    pick(event, ["session_id", "sessionId"]) ??
    pick(event?.session, ["id"]) ??
    pick(event?.properties, ["sessionID", "sessionId"]) ??
    pick(event?.properties?.info, ["sessionID", "sessionId"])
  );
}

function readMessageRole(event: any): string | undefined {
  const role =
    pick(event?.message, ["role"]) ??
    pick(event?.properties?.info, ["role"]) ??
    pick(event?.properties?.message, ["role"]) ??
    pick(event?.message?.author, ["role", "type"]) ??
    pick(event?.part?.author, ["role", "type"]) ??
    pick(event?.properties?.part?.author, ["role", "type"]) ??
    pick(event?.part, ["role"]) ??
    pick(event?.properties?.part, ["role"]) ??
    pick(event?.delta, ["role"]) ??
    pick(event?.properties?.delta, ["role"]) ??
    pick(event, ["role"]);
  if (!role) return undefined;
  const lower = role.toLowerCase();
  if (lower.includes("assistant")) return "assistant";
  if (lower.includes("user")) return "user";
  return undefined;
}

function mapEventType(event: any): string {
  const type = pick(event, ["type", "event", "event_type", "name"]);
  if (!type) return "unknown.event";

  if (type === "message.updated") {
    const role = readMessageRole(event);
    if (role === "assistant") return "message.updated.assistant";
    if (role === "user") return "message.updated.user";
  }

  if (type === "tool.execute.after" && event?.error) {
    return "tool.execute.failure";
  }

  return type;
}

const FORWARDED_EVENTS = new Set([
  "session.created",
  "session.idle",
  "message.updated",
  "message.updated.user",
  "message.updated.assistant",
  "tool.execute.before",
  "tool.execute.after",
  "tool.execute.failure",
  "file.edited",
  "command.executed",
]);

function shouldForwardEvent(eventType: string): boolean {
  return FORWARDED_EVENTS.has(eventType);
}

function resolveRepoPath(projectDirectory: string | undefined, event: any): string | undefined {
  return (
    pick(event, [
      "repo_path",
      "repoPath",
      "directory",
      "cwd",
      "worktree",
      "workspacePath",
    ]) ??
    pick(event?.properties?.info?.path, ["root", "cwd"]) ??
    pick(event?.properties, ["cwd", "worktree"]) ??
    projectDirectory
  );
}

function runProfilerHook(projectDirectory: string | undefined, eventType: string, payload: any): void {
  const dbPath = path.join(
    process.env.USERPROFILE || process.env.HOME || ".",
    ".agent-profiler",
    "events.sqlite"
  );
  const env = { ...process.env, AGENT_PROFILER_DB_PATH: dbPath };

  const profilerCmd = process.platform === "win32" ? "agent-profiler.cmd" : "agent-profiler";
  spawnSync(
    profilerCmd,
    ["hook", "opencode", eventType],
    {
      input: JSON.stringify(payload),
      encoding: "utf8",
      env,
      shell: true,
    },
  );
}

export const AgentProfilerPlugin = async ({ project, directory, worktree }: { project?: any; directory?: string; worktree?: string }) => {
  let projectDirectory = directory || worktree || project?.directory;

  return {
    event: async ({ event }: { event: any }) => {
      if (!projectDirectory) {
        projectDirectory = pick(event, ["directory", "worktree", "cwd"]);
      }

      const mappedEventType = mapEventType(event);
      if (mappedEventType === "unknown.event") return;
      if (!shouldForwardEvent(mappedEventType)) return;

      const sessionId = readSessionId(event);
      const resolvedRepoPath = resolveRepoPath(projectDirectory, event);

      const payload = {
        ...event,
        opencode_event: mappedEventType,
        opencode_version: pick(event, ["app_version", "version"]) ?? "unknown",
        opencode_project_name: project?.name,
        repo_path: resolvedRepoPath,
        session_id: sessionId,
      };

      runProfilerHook(projectDirectory, mappedEventType, payload);
    },
  };
};
