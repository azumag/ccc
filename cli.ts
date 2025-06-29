#!/usr/bin/env -S deno run --allow-read --allow-write=/tmp,.ccc.env,.ccc.env.example --allow-net=discord.com,gateway.discord.gg --allow-env --allow-run=tmux,claude,git --allow-sys
/**
 * Claude Discord Bot CLI Tool
 * Easy installation and management for Claude Discord Bot across multiple projects
 */

import { parseArgs } from "@std/cli/parse-args";
import { load } from "@std/dotenv";
import { ensureDir, exists } from "@std/fs";
import { dirname as _dirname, join } from "@std/path";
// import { Confirm, Input, Secret, Select } from "https://deno.land/x/cliffy@v1.0.0-rc.3/prompt/mod.ts";
import { colors } from "https://deno.land/x/cliffy@v1.0.0-rc.3/ansi/colors.ts";
// Discord.js types are imported by bot.ts

import type { BotConfig, CLIConfig, LogLevel } from "./src/types.ts";
import { detectProjectContext, VERSION } from "./src/utils.ts";
import { ClaudeDiscordBot } from "./src/bot.ts";

// Bot classes (unused in this CLI file but kept for reference)
class _SimpleLogger {
  constructor(private level: string) {}

  info(message: string) {
    if (["debug", "info"].includes(this.level)) {
      console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
    }
  }

  debug(message: string) {
    if (this.level === "debug") {
      console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`);
    }
  }

  warn(message: string) {
    if (["debug", "info", "warn"].includes(this.level)) {
      console.warn(`[WARN] ${new Date().toISOString()} - ${message}`);
    }
  }

  error(message: string) {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`);
  }
}

class _SimpleTmuxManager {
  public workingDir?: string;

  constructor(
    private sessionName: string,
    private logger: _SimpleLogger,
    private config: BotConfig,
    workingDir?: string,
  ) {
    this.workingDir = workingDir;
  }

  async createSession(): Promise<boolean> {
    try {
      const workDir = this.workingDir || Deno.cwd();
      this.logger.info(`Creating tmux session: ${this.sessionName} in ${workDir}`);

      const cmd = new Deno.Command("tmux", {
        args: ["new-session", "-d", "-s", this.sessionName],
        cwd: workDir,
      });

      const process = cmd.spawn();
      const status = await process.status;

      if (status.success) {
        // Build Claude command with dynamic flags
        const claudeFlags = [];

        if (this.config.useDangerouslySkipPermissions) {
          claudeFlags.push("--dangerously-skip-permissions");
        }

        if (this.config.enableResume) {
          claudeFlags.push("-r");
        }

        if (this.config.enableContinue) {
          claudeFlags.push("-c");
        }

        const claudeCommand = `claude ${claudeFlags.join(" ")}`.trim();
        this.logger.info(`Starting Claude Code with command: ${claudeCommand}`);

        // Start Claude Code in the session
        await this.sendCommand(claudeCommand);
        this.logger.info("Claude Code session started successfully");

        // Setup Discord helper script will be done in bot initialization
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Failed to create tmux session: ${error}`);
      return false;
    }
  }

  async sendCommand(command: string): Promise<boolean> {
    try {
      // Clean command (remove trailing newlines)
      const cleanCommand = command.trim();
      this.logger.debug(`Sending command to tmux: "${cleanCommand}"`);

      // Send command text first with option terminator to handle commands starting with -
      const commandCmd = new Deno.Command("tmux", {
        args: ["send-keys", "-t", this.sessionName, "--", cleanCommand],
      });

      const commandProcess = commandCmd.spawn();
      const commandStatus = await commandProcess.status;

      if (!commandStatus.success) {
        this.logger.error("Failed to send command text");
        return false;
      }

      // Dynamic delay based on message length for better reliability
      // Base delay 200ms + additional delay for messages over 200 chars
      const baseDelay = 200;
      const messageLength = cleanCommand.length;
      const additionalDelay = Math.min(Math.floor(messageLength / 200) * 100, 2000); // Max 2 seconds additional
      const totalDelay = baseDelay + additionalDelay;

      this.logger.debug(`Message length: ${messageLength}, delay: ${totalDelay}ms`);
      await new Promise((resolve) => setTimeout(resolve, totalDelay));

      // Send Enter key using C-m (carriage return) for better reliability
      const enterCmd = new Deno.Command("tmux", {
        args: ["send-keys", "-t", this.sessionName, "C-m"],
      });

      const enterProcess = enterCmd.spawn();
      const enterStatus = await enterProcess.status;

      if (!enterStatus.success) {
        this.logger.error("Failed to send Enter key");
        return false;
      }

      // Send a second Enter key after a short delay for additional reliability on long messages
      if (messageLength > 300) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const secondEnterCmd = new Deno.Command("tmux", {
          args: ["send-keys", "-t", this.sessionName, "C-m"],
        });
        const secondEnterProcess = secondEnterCmd.spawn();
        await secondEnterProcess.status;
        this.logger.debug(`Sent second Enter for long message (${messageLength} chars)`);
      }

      this.logger.debug("Successfully sent command and Enter to tmux");
      return true;
    } catch (error) {
      this.logger.error(`Failed to send command: ${error}`);
      return false;
    }
  }

  async sessionExists(): Promise<boolean> {
    try {
      const cmd = new Deno.Command("tmux", {
        args: ["has-session", "-t", this.sessionName],
      });

      const process = cmd.spawn();
      const status = await process.status;
      return status.success;
    } catch {
      return false;
    }
  }
}

// Removed duplicate ClaudeDiscordBot class - using the one from src/bot.ts instead

export class ClaudeDiscordBotCLI {
  private version = VERSION;

  async run(args: string[]): Promise<void> {
    const parsed = parseArgs(args, {
      string: [
        "channel",
        "project",
        "log-level",
        "session",
        "progress-interval",
        "monitor-channel",
      ],
      boolean: [
        "help",
        "version",
        "global",
        "verbose",
        "ultrathink",
        "dangerously-permit",
        "resume",
        "continue",
        "orch",
        "auto-commit",
        "auto-push",
        "progress-update",
        "keep-session",
      ],
      alias: {
        h: "help",
        v: "version",
        c: "channel",
        p: "project",
        s: "session",
        o: "orch",
      },
    });

    if (parsed.help) {
      this.showHelp();
      return;
    }

    if (parsed.version) {
      console.log(`Claude Discord Bot CLI v${this.version}`);
      return;
    }

    const command = parsed._[0] as string;

    switch (command) {
      case "init":
        await this.initCommand(parsed);
        break;
      case "start":
        await this.startCommand(parsed);
        break;
      case "status":
        await this.statusCommand();
        break;
      case "stop":
        await this.stopCommand();
        break;
      case "update":
        await this.updateCommand();
        break;
      case "send-to-discord":
        await this.sendToDiscordCommand(parsed);
        break;
      default:
        console.log(colors.red("Unknown command. Use --help for available commands."));
        break;
    }
  }

  private showHelp(): void {
    console.log(`
${colors.cyan("Claude Discord Bot CLI")} v${this.version}

${colors.yellow("USAGE:")}
  claude-discord-bot <command> [options]

${colors.yellow("COMMANDS:")}
  init              Initialize Claude Discord Bot in current project
  start             Start the bot with specified configuration  
  status            Show current bot status
  stop              Stop the running bot
  update            Update CLI tool to latest version
  send-to-discord   Send message to Discord channel

${colors.yellow("OPTIONS:")}
  -c, --channel <name>     Discord channel name (default: claude)
  -p, --project <path>     Project path (default: current directory)
  --global                 Use global directory (~/.claude-discord-bot)
  --log-level <level>      Log level: debug, info, warn, error
  --ultrathink             Enable ultrathink mode (add to prompt)
  --dangerously-permit     Use --dangerously-skip-permissions for Claude
  --resume                 Start Claude with resume mode (-r flag)
  --continue               Start Claude with continue mode (-c flag)
  -o, --orch               Enable orchestrator mode (/project:orchestrator)
  --auto-commit            Auto commit when task completes
  --auto-push              Auto push when task completes
  --progress-update        Send progress updates to Discord during execution
  --progress-interval <int> Progress update interval (default: 1m, e.g. 30s, 2m)
  --monitor-channel <name|id> Monitor specified channel (by name or ID) and forward messages to tmux
  --keep-session          Keep tmux session alive on bot shutdown
  -h, --help              Show this help
  -v, --version           Show version

${colors.yellow("EXAMPLES:")}
  claude-discord-bot init                           # Interactive setup
  claude-discord-bot init --global                  # Global setup
  claude-discord-bot start --channel dev            # Start with specific channel
  claude-discord-bot start --ultrathink             # Start with ultrathink mode
  claude-discord-bot start --dangerously-permit     # Start with permissions bypassed
  claude-discord-bot start --resume                 # Start with resume mode
  claude-discord-bot start --continue               # Start with continue mode
  claude-discord-bot start --orch                   # Start with orchestrator mode
  claude-discord-bot start --auto-commit --auto-push # Start with auto git operations
  claude-discord-bot start --progress-update        # Start with progress reporting
  claude-discord-bot start --monitor-channel general # Monitor channel by name
  claude-discord-bot start --monitor-channel 123456 # Monitor channel by ID
  claude-discord-bot start --keep-session           # Keep tmux session on shutdown
  claude-discord-bot start --global                 # Start from global directory
  claude-discord-bot status                         # Check bot status
  claude-discord-bot send-to-discord "Hello world"   # Send message to Discord
`);
  }

  private async initCommand(
    args: { _: unknown[]; global?: boolean; project?: string },
  ): Promise<void> {
    console.log(colors.cyan("\n🤖 Claude Discord Bot セットアップ\n"));

    const projectPath = args.project || Deno.cwd();
    const useGlobal = args.global;
    let targetPath: string;

    if (useGlobal) {
      console.log(colors.yellow("🌐 グローバルモードでセットアップ中..."));
      const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "/tmp";
      targetPath = join(homeDir, ".claude-discord-bot");
      await ensureDir(targetPath);
    } else {
      // Project detection
      const projectInfo = await this.detectProject(projectPath as string);
      console.log(`📁 プロジェクト: ${colors.green(projectInfo.name)}`);
      console.log(`🛠️  言語: ${colors.green(projectInfo.language)}`);
      if (projectInfo.framework) {
        console.log(`📦 フレームワーク: ${colors.green(projectInfo.framework)}`);
      }
      targetPath = projectPath as string;
    }

    // Interactive configuration
    const config = this.interactiveSetup(targetPath, useGlobal as boolean);

    // Create configuration files
    const projectInfo = useGlobal
      ? { name: "global", language: "TypeScript" }
      : await this.detectProject(projectPath as string);
    await this.createConfigFiles(config, projectInfo);

    console.log(colors.green("\n✅ セットアップ完了！"));
    console.log(`\n次のステップ:`);
    console.log(`1. Discord Bot を作成して .ccc.env ファイルに設定`);
    console.log(`2. ${colors.cyan("claude-discord-bot start")} でBot起動`);
  }

  protected async detectProject(
    projectPath: string,
  ): Promise<{ name: string; language: string; framework?: string }> {
    const packageJsonPath = join(projectPath, "package.json");
    const denoJsonPath = join(projectPath, "deno.json");
    const cargoTomlPath = join(projectPath, "Cargo.toml");
    const requirementsPath = join(projectPath, "requirements.txt");

    let projectInfo: { name: string; language: string; framework?: string } = {
      name: "unknown-project",
      language: "unknown",
      framework: undefined,
    };

    // Node.js/npm project
    if (await exists(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(await Deno.readTextFile(packageJsonPath));
        projectInfo = {
          name: packageJson.name || "nodejs-project",
          language: "JavaScript/TypeScript",
          framework: this.detectJSFramework(packageJson) || undefined,
        };
      } catch {
        // Ignore parsing errors
      }
    } // Deno project
    else if (await exists(denoJsonPath)) {
      try {
        const denoJson = JSON.parse(await Deno.readTextFile(denoJsonPath));
        projectInfo = {
          name: denoJson.name || "deno-project",
          language: "TypeScript",
          framework: undefined,
        };
      } catch {
        // Ignore parsing errors
      }
    } // Rust project
    else if (await exists(cargoTomlPath)) {
      projectInfo = {
        name: "rust-project",
        language: "Rust",
        framework: undefined,
      };
    } // Python project
    else if (await exists(requirementsPath)) {
      projectInfo = {
        name: "python-project",
        language: "Python",
        framework: undefined,
      };
    }

    return projectInfo;
  }

  private detectJSFramework(
    packageJson: {
      dependencies?: Record<string, unknown>;
      devDependencies?: Record<string, unknown>;
    },
  ): string | null {
    const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };

    if (deps.react) return "React";
    if (deps.vue) return "Vue";
    if (deps.angular) return "Angular";
    if (deps.next) return "Next.js";
    if (deps.nuxt) return "Nuxt";
    if (deps.express) return "Express";
    if (deps.fastify) return "Fastify";

    return null;
  }

  private interactiveSetup(projectPath: string, _useGlobal = false): CLIConfig {
    // Use default values instead of interactive prompts
    const channelName = "claude";
    const tmuxSessionName = "claude-main";
    const logLevel = "info";

    console.log(colors.yellow("📝 デフォルト設定を使用します:"));
    console.log(`  • Discord チャネル名: ${channelName}`);
    console.log(`  • tmux セッション名: ${tmuxSessionName}`);
    console.log(`  • ログレベル: ${logLevel}`);

    return {
      projectPath,
      channelName,
      tmuxSessionName,
      logLevel,
    };
  }

  private async createConfigFiles(config: CLIConfig, _projectInfo: object): Promise<void> {
    const createdFiles: string[] = [];

    // Create .ccc.env file
    const envContent = await this.generateEnvFile(config, config.projectPath);
    await Deno.writeTextFile(join(config.projectPath, ".ccc.env"), envContent);
    createdFiles.push(".ccc.env (Discord設定)");

    // Create .ccc.env.example
    const envExampleContent = await this.generateEnvExampleFile(config.projectPath);
    await Deno.writeTextFile(join(config.projectPath, ".ccc.env.example"), envExampleContent);
    createdFiles.push(".ccc.env.example (設定テンプレート)");

    console.log(`\n📄 処理されたファイル:`);
    for (const file of createdFiles) {
      console.log(`  - ${file}`);
    }
  }

  protected async generateEnvFile(config: CLIConfig, projectPath: string): Promise<string> {
    const envPath = join(projectPath as string, ".ccc.env");
    let existingContent = "";
    const existingVars = new Map<string, string>();

    // 既存の.ccc.envファイルを読み込み
    try {
      existingContent = await Deno.readTextFile(envPath);
      // 既存の環境変数を解析
      for (const line of existingContent.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const [key, ...valueParts] = trimmed.split("=");
          if (key && valueParts.length > 0) {
            existingVars.set(key.trim(), valueParts.join("=").trim());
          }
        }
      }
    } catch {
      // ファイルが存在しない場合は新規作成
    }

    // Claude Discord Bot用の必要な設定項目
    const requiredVars = new Map([
      [
        "DISCORD_BOT_TOKEN",
        config.discordToken || existingVars.get("DISCORD_BOT_TOKEN") || "YOUR_BOT_TOKEN_HERE",
      ],
      ["GUILD_ID", config.guildId || existingVars.get("GUILD_ID") || "YOUR_GUILD_ID_HERE"],
      [
        "AUTHORIZED_USER_ID",
        config.authorizedUserId || existingVars.get("AUTHORIZED_USER_ID") || "YOUR_USER_ID_HERE",
      ],
      [
        "DISCORD_CHANNEL_NAME",
        config.channelName || existingVars.get("DISCORD_CHANNEL_NAME") || "claude",
      ],
      [
        "TMUX_SESSION_NAME",
        config.tmuxSessionName || existingVars.get("TMUX_SESSION_NAME") || "claude-main",
      ],
      ["LOG_LEVEL", config.logLevel || existingVars.get("LOG_LEVEL") || "info"],
    ]);

    // 既存の設定を更新・新規項目を追加
    for (const [key, value] of requiredVars) {
      existingVars.set(key, value);
    }

    // 新しい.envファイルの内容を生成
    let newContent = "";

    // 既存コメントと非Claude設定を保持
    if (existingContent) {
      const lines = existingContent.split("\n");
      const claudeVarNames = Array.from(requiredVars.keys());

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("#") || trimmed === "") {
          // コメント行と空行はそのまま保持
          newContent += line + "\n";
        } else {
          const [key] = trimmed.split("=");
          if (key && !claudeVarNames.includes(key.trim())) {
            // Claude以外の既存設定はそのまま保持
            newContent += line + "\n";
          }
        }
      }
    }

    // Claude Discord Bot設定セクションを追加
    if (!existingContent.includes("# Claude Discord Bot Configuration")) {
      newContent += "\n# Claude Discord Bot Configuration\n";
    }

    // Claude用の設定項目を追加
    const claudeVarNames = Array.from(requiredVars.keys());
    for (const key of claudeVarNames) {
      newContent += `${key}=${existingVars.get(key)}\n`;
    }

    return newContent;
  }

  private async generateEnvExampleFile(projectPath: string): Promise<string> {
    const envExamplePath = join(projectPath, ".ccc.env.example");
    let existingContent = "";

    // 既存の.ccc.env.exampleファイルを読み込み
    try {
      existingContent = await Deno.readTextFile(envExamplePath);
    } catch {
      // ファイルが存在しない場合は新規作成
    }

    // Claude Discord Bot用の設定例
    const claudeBotSection = `
# Claude Discord Bot Configuration Template
DISCORD_BOT_TOKEN=your_discord_bot_token_here
GUILD_ID=your_discord_guild_id_here  
AUTHORIZED_USER_ID=your_discord_user_id_here
DISCORD_CHANNEL_NAME=claude
TMUX_SESSION_NAME=claude-main
LOG_LEVEL=info
`;

    // 既にClaude Discord Bot設定が含まれているかチェック
    if (existingContent.includes("Claude Discord Bot Configuration")) {
      return existingContent; // 既に設定済みの場合はそのまま返す
    }

    // 既存内容に追記
    return existingContent ? existingContent + claudeBotSection : claudeBotSection.trim();
  }

  private async startCommand(
    args: {
      _: unknown[];
      global?: boolean;
      project?: string;
      ultrathink?: boolean;
      "dangerous-permit"?: boolean;
      resume?: boolean;
      continue?: boolean;
      orch?: boolean;
      "auto-commit"?: boolean;
      "auto-push"?: boolean;
      "progress-update"?: boolean;
      "progress-interval"?: string;
      "monitor-channel"?: string;
      "monitor-interval"?: string;
      "keep-session"?: boolean;
    },
  ): Promise<void> {
    console.log(colors.cyan("🚀 Claude Discord Bot 起動中..."));

    const projectPath = args.project || Deno.cwd();
    const envPath = join(projectPath as string, ".ccc.env");

    // Use global directory if local files don't exist or --global flag is used
    const useGlobal = args.global || !await exists(envPath);
    let configPath: string;

    if (useGlobal) {
      console.log(colors.yellow("🌐 グローバルモードで起動中..."));
      const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "/tmp";
      const globalDir = join(homeDir, ".claude-discord-bot");
      configPath = join(globalDir, ".ccc.env");

      if (!await exists(configPath)) {
        console.log(colors.red("❌ グローバル設定が見つかりません"));
        console.log("まず 'claude-discord-bot init --global' を実行してください");
        return;
      }
    } else {
      configPath = envPath;

      if (!await exists(envPath)) {
        console.log(colors.red("❌ .ccc.env ファイルが見つかりません"));
        console.log("まず 'claude-discord-bot init' を実行してください");
        return;
      }
    }

    // Load environment variables
    console.log(colors.yellow("📦 設定を読み込み中..."));
    try {
      await load({ export: true, envPath: configPath });
    } catch (error) {
      console.log(colors.red(`❌ 設定ファイルの読み込みに失敗しました: ${error}`));
      return;
    }

    // Validate required environment variables
    const requiredVars = [
      "DISCORD_BOT_TOKEN",
      "GUILD_ID",
      "DISCORD_CHANNEL_NAME",
    ];

    for (const varName of requiredVars) {
      if (!Deno.env.get(varName)) {
        console.log(colors.red(`❌ 必須環境変数が設定されていません: ${varName}`));
        console.log("まず 'claude-discord-bot init' を実行して設定を完了してください");
        return;
      }
    }

    // Detect project context
    const workingDir = useGlobal ? Deno.cwd() : projectPath;
    const projectContext = await detectProjectContext(workingDir);

    // Create bot configuration
    const config: BotConfig = {
      discordToken: Deno.env.get("DISCORD_BOT_TOKEN")!,
      guildId: Deno.env.get("GUILD_ID")!,
      authorizedUserId: Deno.env.get("AUTHORIZED_USER_ID"),
      channelName: Deno.env.get("DISCORD_CHANNEL_NAME") || "claude",
      tmuxSessionName: Deno.env.get("TMUX_SESSION_NAME") || "claude-main",
      logLevel: (Deno.env.get("LOG_LEVEL") as LogLevel) || "info",
      enableUltraThink: args.ultrathink || false,
      orchestratorMode: args.orch || false,
      useDangerouslySkipPermissions:
        Boolean((args as Record<string, unknown>)["dangerously-permit"]) || false,
      enableResume: args.resume || false,
      enableContinue: args.continue || false,
      autoCommit: args["auto-commit"] || false,
      autoPush: args["auto-push"] || false,
      progressUpdate: args["progress-update"] || false,
      progressInterval: args["progress-interval"] || "1m",
      monitorChannelId: args["monitor-channel"],
      monitorInterval: args["monitor-interval"],
      keepSessionOnShutdown: args["keep-session"] || false,
      projectContext,
    };

    console.log(colors.green("🤖 Bot を起動しています..."));
    console.log(`📋 設定: チャネル=#${config.channelName}, セッション=${config.tmuxSessionName}`);

    try {
      // Create and start bot directly
      const bot = new ClaudeDiscordBot(config);
      await bot.start();

      console.log(colors.green("✅ Bot が正常に起動しました"));
      console.log(`🔗 tmuxセッション接続: tmux attach -t ${config.tmuxSessionName}`);

      // Handle graceful shutdown
      const shutdown = async () => {
        console.log("\n🛑 シャットダウン中...");
        await bot.shutdown();
        Deno.exit(0);
      };

      // Handle Ctrl+C
      Deno.addSignalListener("SIGINT", shutdown);
      Deno.addSignalListener("SIGTERM", shutdown);
    } catch (error) {
      console.log(colors.red(`❌ Bot の起動に失敗しました: ${error}`));
      console.log("Discord Bot Token や Guild ID が正しく設定されているか確認してください");
    }
  }

  private statusCommand(): void {
    console.log(colors.cyan("📊 Claude Discord Bot ステータス"));
    console.log("ステータス確認機能は実装中です");
  }

  private stopCommand(): void {
    console.log(colors.yellow("⏹️  Claude Discord Bot 停止中..."));
    console.log("停止機能は実装中です");
  }

  private updateCommand(): void {
    console.log(colors.cyan("📦 CLI更新確認中..."));
    console.log("更新機能は実装中です");
  }

  /**
   * Process message for better readability while keeping security-sensitive escaping
   */
  private processMessageForReadability(message: string): string {
    return message
      // Convert common escape sequences to actual characters for readability
      .replace(/\\n/g, "\n") // \n to actual newline
      .replace(/\\t/g, "\t") // \t to actual tab
      .replace(/\\r/g, "\r"); // \r to carriage return
    // Keep security-sensitive characters escaped (these should remain escaped)
    // Dollar signs, backticks, double quotes etc. are left as-is for security
  }

  private async sendToDiscordCommand(args: { _: unknown[]; session?: string }): Promise<void> {
    let message = (args as { _: unknown[] })._[1] as string;
    const sessionName = args.session || Deno.env.get("TMUX_SESSION_NAME") || "claude-main";

    if (!message) {
      console.log(colors.red("❌ メッセージが指定されていません"));
      console.log(
        '使用方法: claude-discord-bot send-to-discord "メッセージ内容" [--session セッション名]',
      );
      return;
    }

    try {
      // Process message for better readability
      message = this.processMessageForReadability(message);

      // Split long messages to handle Discord's 2000 character limit
      const messageChunks = this.splitMessageForDiscord(message);

      for (let i = 0; i < messageChunks.length; i++) {
        const chunk = messageChunks[i];
        const pendingMessage = {
          content: chunk,
          timestamp: new Date().toISOString(),
          type: "claude-response",
          isChunk: messageChunks.length > 1,
          chunkIndex: i + 1,
          totalChunks: messageChunks.length,
        };

        const pendingFile = `/tmp/claude-discord-pending-${sessionName}-${i + 1}.json`;
        await Deno.writeTextFile(pendingFile, JSON.stringify(pendingMessage, null, 2));
      }

      if (messageChunks.length > 1) {
        console.log(
          colors.green(
            `✅ メッセージを${messageChunks.length}つのチャンクに分割してDiscordに送信キューに追加しました (セッション: ${sessionName})`,
          ),
        );
      } else {
        console.log(
          colors.green(
            `✅ メッセージをDiscordに送信キューに追加しました (セッション: ${sessionName})`,
          ),
        );
      }
    } catch (error) {
      console.log(colors.red(`❌ メッセージの送信に失敗しました: ${error}`));
    }
  }

  /**
   * Split long messages for Discord's character limit
   */
  private splitMessageForDiscord(message: string): string[] {
    const maxLength = 1900; // Discord limit minus buffer

    if (message.length <= maxLength) {
      return [message];
    }

    const chunks: string[] = [];
    const lines = message.split("\n");
    let currentChunk = "";

    for (const line of lines) {
      // If adding this line would exceed the limit
      if (currentChunk.length + line.length + 1 > maxLength) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? "\n" : "") + line;
      }
    }

    // Add the last chunk if it has content
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // Add chunk indicators for multiple chunks
    if (chunks.length > 1) {
      return chunks.map((chunk, index) => {
        const indicator = `📄 **[${index + 1}/${chunks.length}]**\n\n`;
        return indicator + chunk;
      });
    }

    return chunks;
  }
}

// Main execution
if (import.meta.main) {
  const cli = new ClaudeDiscordBotCLI();
  await cli.run(Deno.args);
}
