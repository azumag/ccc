/**
 * Claude Code execution interface for Discord Bot
 */

import { TmuxSessionManager } from "./tmux.ts";
import { DiscordAPIBridge } from "./discord-api.ts";
// Using Deno built-in APIs instead of std library
import type { ClaudeResponse, Logger, ProjectContext } from "./types.ts";

export class ClaudeCodeExecutor {
  private tmuxManager: TmuxSessionManager;
  private projectContext: ProjectContext;
  private logger: Logger;
  private enableUltraThink: boolean;

  constructor(
    tmuxManager: TmuxSessionManager,
    projectContext: ProjectContext,
    logger: Logger,
    enableUltraThink: boolean = false,
  ) {
    this.tmuxManager = tmuxManager;
    this.projectContext = projectContext;
    this.logger = logger;
    this.enableUltraThink = enableUltraThink;
  }

  /**
   * Execute a prompt in Claude Code via tmux
   */
  async executePrompt(prompt: string, channelId: string): Promise<ClaudeResponse> {
    const startTime = Date.now();
    this.logger.info(`Executing Claude prompt: ${prompt.substring(0, 100)}...`);

    try {
      // Ensure tmux session exists
      if (!(await this.tmuxManager.hasSession())) {
        this.logger.info("Creating new tmux session for Claude");
        const created = await this.tmuxManager.createSession(this.projectContext.rootPath);
        if (!created) {
          return {
            content: "",
            success: false,
            error: "Failed to create tmux session",
            executionTime: Date.now() - startTime,
          };
        }
        
        // Setup Discord response helper
        await this.setupDiscordHelper();
      }

      // Save channel ID for Claude to use
      await Deno.writeTextFile("/tmp/claude-discord-channel.txt", channelId);

      // Create enhanced prompt that instructs Claude to use the Discord helper
      const enhancedPrompt = this.createEnhancedPrompt(prompt);

      // Send prompt to Claude
      const sent = await this.tmuxManager.sendPrompt(enhancedPrompt);
      if (!sent) {
        return {
          content: "",
          success: false,
          error: "Failed to send prompt to Claude",
          executionTime: Date.now() - startTime,
        };
      }

      // Monitor for responses
      const response = await this.waitForDiscordResponse(30000); // 30 second timeout
      const executionTime = Date.now() - startTime;

      // Even if we don't get a response through the bridge, the task might still be successful
      // if Claude has already sent responses directly via discord-respond.ts
      if (!response) {
        this.logger.info("No response received via Discord bridge, but Claude may have responded directly");
        return {
          content: "✅ タスクが完了しました（Claudeから直接応答済み）",
          success: true,
          executionTime,
        };
      }

      this.logger.info(`Claude response received via Discord bridge`);
      return {
        content: response.content,
        success: true,
        executionTime,
      };
    } catch (error) {
      this.logger.error(
        `Claude execution failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        content: "",
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Create enhanced prompt that instructs Claude to respond via Discord
   */
  private createEnhancedPrompt(userPrompt: string): string {
    const ultrathinkText = this.enableUltraThink ? '\n\nultrathink\n' : '';
    
    return `${userPrompt}${ultrathinkText}

重要: 実行結果や応答を以下のコマンドでDiscordに送信してください:
./discord-respond.ts "あなたの応答内容"`;
  }

  /**
   * Setup Discord helper script for Claude
   */
  private async setupDiscordHelper(): Promise<void> {
    const helperScript = DiscordAPIBridge.generateClaudeHelperScript();
    const scriptPath = `${this.projectContext.rootPath}/discord-respond.ts`;
    
    await Deno.writeTextFile(scriptPath, helperScript);
    
    // Make it executable
    await this.tmuxManager.sendPrompt(`chmod +x ${scriptPath}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    this.logger.info("Discord helper script created");
  }

  /**
   * Wait for Discord response from Claude
   */
  private async waitForDiscordResponse(timeout: number) {
    const startTime = Date.now();
    const checkInterval = 500; // Check every 500ms

    while (Date.now() - startTime < timeout) {
      const response = await DiscordAPIBridge.readResponse();
      if (response) {
        return response;
      }
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    return null;
  }

  /**
   * Calculate wait time based on prompt complexity
   */
  private calculateWaitTime(prompt: string): number {
    const baseTime = 5000; // 5 seconds base (increased from 3)
    const lengthFactor = Math.min(prompt.length / 100, 5); // Max 5x multiplier
    const complexityBonus = this.analyzeComplexity(prompt) * 1000; // Up to 3s extra

    return Math.min(baseTime + lengthFactor * 1000 + complexityBonus, 30000); // Max 30s
  }

  /**
   * Analyze prompt complexity to determine wait time
   */
  private analyzeComplexity(prompt: string): number {
    let complexity = 0;

    // File operations
    if (
      prompt.toLowerCase().includes("create") ||
      prompt.toLowerCase().includes("generate") ||
      prompt.toLowerCase().includes("write")
    ) {
      complexity += 1;
    }

    // Multiple files
    if (prompt.split("file").length > 2) {
      complexity += 1;
    }

    // Code analysis
    if (
      prompt.toLowerCase().includes("analyze") ||
      prompt.toLowerCase().includes("review") ||
      prompt.toLowerCase().includes("refactor")
    ) {
      complexity += 1;
    }

    // Testing
    if (
      prompt.toLowerCase().includes("test") ||
      prompt.toLowerCase().includes("spec")
    ) {
      complexity += 0.5;
    }

    return Math.min(complexity, 3); // Max 3 extra seconds
  }

  /**
   * Restart Claude session
   */
  async restartSession(): Promise<boolean> {
    this.logger.info("Restarting Claude session");
    return await this.tmuxManager.restartSession(this.projectContext.rootPath);
  }

  /**
   * Get session status
   */
  async getSessionStatus() {
    return await this.tmuxManager.getSessionStatus();
  }

  /**
   * Check if Claude Code is available
   */
  static async checkClaudeAvailable(): Promise<boolean> {
    try {
      const command = new Deno.Command("claude", {
        args: ["--version"],
        stdout: "piped",
        stderr: "piped",
      });

      const { code } = await command.output();
      return code === 0;
    } catch {
      return false;
    }
  }

  /**
   * Format Claude response for Discord
   */
  formatResponseForDiscord(response: ClaudeResponse): string[] {
    if (!response.success) {
      return [`❌ **エラー**: ${response.error}`];
    }

    const content = response.content;
    const maxLength = 1900; // Discord limit minus some buffer for formatting
    const messages: string[] = [];

    if (content.length <= maxLength) {
      return [this.wrapInCodeBlock(content)];
    }

    // Split long responses
    const chunks = this.splitResponse(content, maxLength);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const prefix = i === 0 ? "" : `**続き (${i + 1}/${chunks.length})**\n`;
      messages.push(prefix + this.wrapInCodeBlock(chunk));
    }

    return messages;
  }

  /**
   * Split long response into chunks
   */
  private splitResponse(content: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let currentChunk = "";

    const lines = content.split("\n");
    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > maxLength) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? "\n" : "") + line;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Wrap content in Discord code block
   */
  private wrapInCodeBlock(content: string): string {
    // Try to detect language for syntax highlighting
    const language = this.detectLanguage(content);
    return `\`\`\`${language}\n${content}\n\`\`\``;
  }

  /**
   * Detect programming language from content
   */
  private detectLanguage(content: string): string {
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes("import") && lowerContent.includes("from")) {
      if (lowerContent.includes("react") || lowerContent.includes("jsx")) {
        return "jsx";
      }
      return "typescript";
    }

    if (lowerContent.includes("function") || lowerContent.includes("const")) {
      return "javascript";
    }

    if (lowerContent.includes("def ") || lowerContent.includes("import ")) {
      return "python";
    }

    if (lowerContent.includes("fn ") || lowerContent.includes("cargo")) {
      return "rust";
    }

    if (lowerContent.includes("<!doctype") || lowerContent.includes("<html")) {
      return "html";
    }

    if (lowerContent.includes("{") && lowerContent.includes("}")) {
      return "json";
    }

    // Default to the project language
    return this.projectContext.language || "";
  }
}
