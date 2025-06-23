/**
 * Tmux session management for Claude Discord Bot
 */

import type { CommandResult, Logger, TmuxCommand, TmuxSessionStatus } from "./types.ts";

export class TmuxSessionManager {
  private sessionName: string;
  private lastActivity: Date;
  private logger: Logger;
  private useDangerouslySkipPermissions: boolean;
  private enableResume: boolean;
  private enableContinue: boolean;

  constructor(
    sessionName = "claude-main",
    logger: Logger,
    useDangerouslySkipPermissions = false,
    enableResume = false,
    enableContinue = false,
  ) {
    this.sessionName = sessionName;
    this.lastActivity = new Date();
    this.logger = logger;
    this.useDangerouslySkipPermissions = useDangerouslySkipPermissions;
    this.enableResume = enableResume;
    this.enableContinue = enableContinue;
  }

  /**
   * Execute a tmux command
   */
  private async executeTmuxCommand(tmuxCmd: TmuxCommand): Promise<CommandResult> {
    const command = new Deno.Command("tmux", {
      args: tmuxCmd.args,
      cwd: tmuxCmd.cwd,
      stdout: "piped",
      stderr: "piped",
    });

    try {
      const { code, stdout, stderr } = await command.output();
      const result = {
        code,
        stdout: new TextDecoder().decode(stdout),
        stderr: new TextDecoder().decode(stderr),
        success: code === 0,
      };

      this.logger.debug(`Tmux command: ${tmuxCmd.args.join(" ")}`);
      this.logger.debug(`Exit code: ${code}`);
      if (!result.success) {
        this.logger.warn(`Tmux command failed: ${result.stderr}`);
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to execute tmux command: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        code: -1,
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
        success: false,
      };
    }
  }

  /**
   * Check if tmux session exists
   */
  async hasSession(): Promise<boolean> {
    const result = await this.executeTmuxCommand({
      args: ["has-session", "-t", this.sessionName],
    });
    return result.success;
  }

  /**
   * Create a new tmux session with Claude Code
   */
  async createSession(projectRoot: string): Promise<boolean> {
    this.logger.info(`Creating tmux session: ${this.sessionName}`);

    // Create detached session
    const createResult = await this.executeTmuxCommand({
      args: ["new-session", "-d", "-s", this.sessionName, "-c", projectRoot],
    });

    if (!createResult.success) {
      this.logger.error(`Failed to create tmux session: ${createResult.stderr}`);
      return false;
    }

    // Start Claude Code in the main pane
    let claudeCommand = "claude";

    if (this.useDangerouslySkipPermissions) {
      claudeCommand += " --dangerously-skip-permissions";
    }

    if (this.enableResume) {
      claudeCommand += " -r";
    }

    if (this.enableContinue) {
      claudeCommand += " -c";
    }

    // Send Claude command first
    const claudeCommandResult = await this.executeTmuxCommand({
      args: [
        "send-keys",
        "-t",
        this.sessionName,
        "--",
        claudeCommand,
      ],
    });

    if (!claudeCommandResult.success) {
      this.logger.error(`Failed to send Claude command: ${claudeCommandResult.stderr}`);
      await this.killSession(); // Cleanup failed session
      return false;
    }

    // Dynamic delay based on command length for better reliability
    // Base delay 150ms + additional delay for long commands
    const baseDelay = 150;
    const commandLength = claudeCommand.length;
    const additionalDelay = Math.min(Math.floor(commandLength / 1000) * 100, 2000); // Max 2 seconds additional
    const totalDelay = baseDelay + additionalDelay;

    this.logger.debug(`Command length: ${commandLength}, delay: ${totalDelay}ms`);
    await new Promise((resolve) => setTimeout(resolve, totalDelay));

    // Send Enter key separately using C-m for better reliability
    const claudeResult = await this.executeTmuxCommand({
      args: [
        "send-keys",
        "-t",
        this.sessionName,
        "C-m",
      ],
    });

    if (!claudeResult.success) {
      this.logger.error(`Failed to start Claude in tmux: ${claudeResult.stderr}`);
      await this.killSession(); // Cleanup failed session
      return false;
    }

    // Wait for Claude to start and check if it's ready
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Send a test prompt to ensure Claude is ready
    this.logger.debug("Sending test prompt to verify Claude is ready...");
    await this.sendPrompt("echo ready");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    this.logger.info(`Claude Code started in tmux session: ${this.sessionName}`);
    return true;
  }

  /**
   * Send prompt to Claude Code in tmux session
   */
  async sendPrompt(prompt: string): Promise<boolean> {
    this.updateActivity();

    // Clean prompt (remove trailing newlines)
    const cleanPrompt = prompt.trim();
    this.logger.debug(`Sending prompt to Claude: "${cleanPrompt}"`);

    // Send prompt text
    const promptResult = await this.executeTmuxCommand({
      args: ["send-keys", "-t", this.sessionName, "--", cleanPrompt],
    });

    if (!promptResult.success) {
      this.logger.error(`Failed to send prompt text: ${promptResult.stderr}`);
      return false;
    }

    // Dynamic delay based on message length for better reliability
    // Base delay 150ms + additional delay for long messages
    const baseDelay = 150;
    const messageLength = cleanPrompt.length;
    const additionalDelay = Math.min(Math.floor(messageLength / 1000) * 100, 2000); // Max 2 seconds additional
    const totalDelay = baseDelay + additionalDelay;

    this.logger.debug(`Message length: ${messageLength}, delay: ${totalDelay}ms`);
    await new Promise((resolve) => setTimeout(resolve, totalDelay));

    // Send Enter key using C-m (carriage return) for better reliability
    const enterResult = await this.executeTmuxCommand({
      args: ["send-keys", "-t", this.sessionName, "C-m"],
    });

    if (!enterResult.success) {
      this.logger.error(`Failed to send Enter key: ${enterResult.stderr}`);
      return false;
    }

    this.logger.debug(`Successfully sent prompt and Enter to Claude`);
    return true;
  }

  /**
   * Alternative method to send prompt using literal text input
   */
  async sendPromptLiteral(prompt: string): Promise<boolean> {
    this.updateActivity();

    const cleanPrompt = prompt.trim();
    this.logger.debug(`Sending literal prompt to Claude: "${cleanPrompt}"`);

    // Type the prompt character by character and then send Enter
    const result = await this.executeTmuxCommand({
      args: ["send-keys", "-t", this.sessionName, "-l", cleanPrompt],
    });

    if (!result.success) {
      this.logger.error(`Failed to send literal prompt: ${result.stderr}`);
      return false;
    }

    // Dynamic delay based on message length for better reliability
    // Base delay 150ms + additional delay for long messages
    const baseDelay = 150;
    const messageLength = cleanPrompt.length;
    const additionalDelay = Math.min(Math.floor(messageLength / 1000) * 100, 2000); // Max 2 seconds additional
    const totalDelay = baseDelay + additionalDelay;

    this.logger.debug(`Message length: ${messageLength}, delay: ${totalDelay}ms`);
    await new Promise((resolve) => setTimeout(resolve, totalDelay));

    // Send Enter
    const enterResult = await this.executeTmuxCommand({
      args: ["send-keys", "-t", this.sessionName, "C-m"],
    });

    if (enterResult.success) {
      this.logger.debug(`Successfully sent literal prompt and Enter to Claude`);
    } else {
      this.logger.error(`Failed to send Enter after literal prompt: ${enterResult.stderr}`);
    }

    return enterResult.success;
  }

  /**
   * Capture output from tmux pane
   */
  async captureOutput(): Promise<string> {
    const result = await this.executeTmuxCommand({
      args: ["capture-pane", "-t", this.sessionName, "-p", "-S", "-"],
    });

    if (!result.success) {
      this.logger.error(`Failed to capture tmux output: ${result.stderr}`);
      return "";
    }

    this.logger.debug(`Raw tmux output (${result.stdout.length} chars):\n${result.stdout}`);
    return this.parseClaudeOutput(result.stdout);
  }

  /**
   * Parse Claude's response from tmux output
   */
  private parseClaudeOutput(rawOutput: string): string {
    const lines = rawOutput.split("\n");
    const claudeResponse: string[] = [];
    const _capturing = false;
    const _foundResponse = false;
    let lastPromptIndex = -1;

    this.logger.debug(`Parsing ${lines.length} lines of output`);

    // Find all prompt positions
    const promptIndices: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line && (line.includes("❯") || line.includes(">") || line.includes("$"))) {
        promptIndices.push(i);
        this.logger.debug(`Found prompt at line ${i}: ${line}`);
      }
    }

    // If we have at least 2 prompts, capture between the last two
    if (promptIndices.length >= 2) {
      const startIndex = (promptIndices[promptIndices.length - 2] ?? 0) + 1;
      const endIndex = promptIndices[promptIndices.length - 1] ?? lines.length;

      this.logger.debug(`Capturing between lines ${startIndex} and ${endIndex}`);

      for (let i = startIndex; i < endIndex; i++) {
        const line = lines[i];
        if (line && !this.isLogLine(line) && line.trim()) {
          claudeResponse.push(line);
        }
      }
    } else {
      // Fallback: capture everything after the last prompt
      if (promptIndices.length > 0) {
        lastPromptIndex = promptIndices[promptIndices.length - 1] ?? 0;
        for (let i = lastPromptIndex + 1; i < lines.length; i++) {
          const line = lines[i];
          if (line && !this.isLogLine(line) && line.trim()) {
            claudeResponse.push(line);
          }
        }
      }
    }

    // Clean up the response
    const response = claudeResponse.join("\n").trim();

    this.logger.debug(`Final Claude response: ${response.length} characters`);
    this.logger.debug(`Response preview: ${response.substring(0, 200)}...`);
    return response;
  }

  /**
   * Check if a line is a log line that should be filtered out
   */
  private isLogLine(line: string): boolean {
    return (
      line.includes("✻ Coalescing") ||
      line.includes("↓") ||
      line.includes("tokens") ||
      line.includes("esc to interrupt") ||
      line.includes("───────") ||
      line.includes("╭─") ||
      line.includes("╰─") ||
      line.includes("│") ||
      line.startsWith("[") // Timestamp logs
    );
  }

  /**
   * Kill the tmux session
   */
  async killSession(): Promise<boolean> {
    this.logger.info(`Killing tmux session: ${this.sessionName}`);

    const result = await this.executeTmuxCommand({
      args: ["kill-session", "-t", this.sessionName],
    });

    if (result.success) {
      this.logger.info(`Successfully killed tmux session: ${this.sessionName}`);
    } else {
      this.logger.warn(`Failed to kill tmux session: ${result.stderr}`);
    }

    return result.success;
  }

  /**
   * Restart the session (kill and recreate)
   */
  async restartSession(projectRoot: string): Promise<boolean> {
    this.logger.info(`Restarting tmux session: ${this.sessionName}`);

    await this.killSession();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return await this.createSession(projectRoot);
  }

  /**
   * Get session status information
   */
  async getSessionStatus(): Promise<TmuxSessionStatus> {
    const exists = await this.hasSession();

    if (!exists) {
      return {
        exists: false,
        uptime: "停止中",
      };
    }

    // Get session info (unused for now, but could be used for more detailed status)
    const _infoResult = await this.executeTmuxCommand({
      args: ["list-sessions", "-t", this.sessionName, "-F", "#{session_created}"],
    });

    const minutesAgo = Math.floor(
      (Date.now() - this.lastActivity.getTime()) / 1000 / 60,
    );

    return {
      exists: true,
      uptime: minutesAgo > 0 ? `${minutesAgo}分前` : "1分以内",
      paneCount: 1, // Single Claude pane
    };
  }

  /**
   * Update last activity timestamp
   */
  updateActivity(): void {
    this.lastActivity = new Date();
  }

  /**
   * Get list of all Claude-related tmux sessions
   */
  async listClaudeSessions(): Promise<string[]> {
    const result = await this.executeTmuxCommand({
      args: ["list-sessions", "-F", "#{session_name}"],
    });

    if (!result.success) {
      return [];
    }

    return result.stdout
      .split("\n")
      .filter((line) => line.includes("claude"))
      .filter((line) => line.trim().length > 0);
  }

  /**
   * Check if tmux is installed and available
   */
  static async checkTmuxAvailable(): Promise<boolean> {
    try {
      const command = new Deno.Command("tmux", {
        args: ["-V"],
        stdout: "piped",
        stderr: "piped",
      });

      const { code } = await command.output();
      return code === 0;
    } catch {
      return false;
    }
  }
}
