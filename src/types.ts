/**
 * Type definitions for the Claude Discord Bot
 */

export interface ProjectContext {
  /** Project root directory path */
  rootPath: string;
  /** Project name (from package.json or directory name) */
  projectName: string;
  /** Detected programming language */
  language: string;
  /** Detected framework (if any) */
  framework?: string;
  /** Git repository URL (if available) */
  gitRepo?: string;
  /** Package manager type */
  packageManager?: "npm" | "yarn" | "pnpm" | "deno" | "cargo" | "pip";
}

export interface TmuxSessionStatus {
  /** Whether the tmux session exists */
  exists: boolean;
  /** Time since last activity */
  uptime: string;
  /** Number of panes in session */
  paneCount?: number;
}

export interface ClaudeResponse {
  /** Response content from Claude */
  content: string;
  /** Whether the response was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Execution time in milliseconds */
  executionTime?: number;
}

export interface BotConfig {
  /** Discord bot token */
  discordToken: string;
  /** Discord guild (server) ID */
  guildId: string;
  /** Authorized user ID */
  authorizedUserId: string;
  /** Target channel name to monitor */
  channelName: string;
  /** Project context */
  projectContext: ProjectContext;
  /** Tmux session name */
  tmuxSessionName: string;
  /** Log level */
  logLevel: "debug" | "info" | "warn" | "error";
  /** Whether to use dangerously-skip-permissions for Claude */
  useDangerouslySkipPermissions?: boolean;
  /** Whether to enable resume mode (-r flag for Claude) */
  enableResume?: boolean;
  /** Whether to enable continue mode (-c flag for Claude) */
  enableContinue?: boolean;
}

export interface CommandResult {
  /** Exit code */
  code: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Success flag */
  success: boolean;
}

export interface SpecialCommand {
  /** Command name */
  name: string;
  /** Command description */
  description: string;
  /** Handler function */
  handler: (message: unknown) => Promise<void>;
}

export interface TmuxCommand {
  /** Tmux command arguments */
  args: string[];
  /** Working directory */
  cwd?: string;
  /** Timeout in milliseconds */
  timeout?: number;
}

export interface BotStats {
  /** Bot start time */
  startTime: Date;
  /** Total messages processed */
  messagesProcessed: number;
  /** Total commands executed */
  commandsExecuted: number;
  /** Last activity time */
  lastActivity: Date;
  /** Current session status */
  sessionStatus: TmuxSessionStatus;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}
