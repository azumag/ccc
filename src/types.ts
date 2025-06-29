/**
 * Shared interfaces and types for Claude Discord Bot CLI
 */

// Log level type definition
export type LogLevel = "debug" | "info" | "warn" | "error";

// Logger interface
export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  setLevel(level: LogLevel): void;
}

// Command execution result
export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
  success: boolean;
}

// Tmux command structure
export interface TmuxCommand {
  args: string[];
  cwd?: string;
}

// Tmux session status
export interface TmuxSessionStatus {
  exists: boolean;
  uptime: string;
  paneCount?: number;
}

// Project context information
export interface ProjectContext {
  rootPath: string;
  projectName?: string;
  name?: string;
  type?: string;
  language?: string;
  framework?: string;
  packageManager?: string;
  gitRepo?: string;
}

// Claude response structure
export interface ClaudeResponse {
  content: string;
  success: boolean;
  error?: string;
  executionTime?: number;
}

// Special command definition
export interface SpecialCommand {
  name: string;
  description: string;
  handler: (message: unknown) => Promise<void>;
}

export interface CLIConfig {
  projectPath: string;
  channelName: string;
  discordToken?: string;
  guildId?: string;
  authorizedUserId?: string;
  tmuxSessionName: string;
  logLevel: LogLevel;
  orchestratorMode?: boolean;
}

export interface BotConfig {
  discordToken: string;
  guildId: string;
  authorizedUserId?: string;
  channelName: string;
  tmuxSessionName: string;
  logLevel: LogLevel;
  enableUltraThink?: boolean;
  orchestratorMode?: boolean;
  useDangerouslySkipPermissions?: boolean;
  enableResume?: boolean;
  enableContinue?: boolean;
  autoCommit?: boolean;
  autoPush?: boolean;
  progressUpdate?: boolean;
  progressInterval?: string;
  monitorChannelId?: string;
  monitorInterval?: string;
  keepSessionOnShutdown?: boolean;
  projectContext: ProjectContext;
}

export interface BotStats {
  startTime: Date;
  messagesProcessed: number;
  commandsExecuted: number;
  lastActivity: Date;
  sessionStatus: { exists: boolean; uptime: string };
}

export interface ImportConfig {
  parseArgs: string;
  dotenv: string;
  fs: string;
  path: string;
}

export const IMPORT_CONFIGS = {
  "import-maps": {
    parseArgs: "@std/cli/parse-args",
    dotenv: "@std/dotenv",
    fs: "@std/fs",
    path: "@std/path",
  },
  "full-urls": {
    parseArgs: "jsr:@std/cli/parse-args",
    dotenv: "jsr:@std/dotenv",
    fs: "jsr:@std/fs",
    path: "jsr:@std/path",
  },
} as const;

export type ImportType = keyof typeof IMPORT_CONFIGS;
