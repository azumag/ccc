#!/usr/bin/env -S deno run --allow-all
/**
 * Claude Discord Bot CLI Tool (Standalone Version)
 * Easy installation and management for Claude Discord Bot across multiple projects
 * This version uses full URLs for imports to work without import maps
 */

import { parseArgs } from "jsr:@std/cli/parse-args";
import { load } from "jsr:@std/dotenv";
import { ensureDir, exists } from "jsr:@std/fs";
import { dirname as _dirname, join } from "jsr:@std/path";
// import { Confirm, Input, Secret, Select } from "https://deno.land/x/cliffy@v1.0.0-rc.3/prompt/mod.ts";
import { colors } from "https://deno.land/x/cliffy@v1.0.0-rc.3/ansi/colors.ts";
import { Client, GatewayIntentBits, Message, TextChannel } from "npm:discord.js@14";

const VERSION = "1.8.5";

interface CLIConfig {
  projectPath: string;
  channelName: string;
  discordToken?: string;
  guildId?: string;
  authorizedUserId?: string;
  tmuxSessionName: string;
  logLevel: string;
}

// Bot interfaces
interface BotConfig {
  discordToken: string;
  guildId: string;
  authorizedUserId?: string;
  channelName: string;
  tmuxSessionName: string;
  logLevel: string;
}

interface BotStats {
  startTime: Date;
  messagesProcessed: number;
  commandsExecuted: number;
  lastActivity: Date;
  sessionStatus: { exists: boolean; uptime: string };
}

// Bot classes
class SimpleLogger {
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

class SimpleTmuxManager {
  public workingDir?: string;
  
  constructor(private sessionName: string, private logger: SimpleLogger, workingDir?: string) {
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
        // Start Claude Code in the session
        await this.sendCommand("claude --dangerously-skip-permissions");
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

      // Send command text first
      const commandCmd = new Deno.Command("tmux", {
        args: ["send-keys", "-t", this.sessionName, "--", cleanCommand],
      });

      const commandProcess = commandCmd.spawn();
      const commandStatus = await commandProcess.status;
      
      if (!commandStatus.success) {
        this.logger.error("Failed to send command text");
        return false;
      }

      // Small delay before sending Enter
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Send Enter key explicitly
      const enterCmd = new Deno.Command("tmux", {
        args: ["send-keys", "-t", this.sessionName, "Enter"],
      });

      const enterProcess = enterCmd.spawn();
      const enterStatus = await enterProcess.status;
      
      if (!enterStatus.success) {
        this.logger.error("Failed to send Enter key");
        return false;
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

class ClaudeDiscordBot {
  private config: BotConfig;
  private client: Client;
  private tmuxManager: SimpleTmuxManager;
  private logger: SimpleLogger;
  private targetChannelId = "";
  private stats: BotStats;

  constructor(config: BotConfig, workingDir?: string) {
    this.config = config;
    this.logger = new SimpleLogger(config.logLevel);
    this.tmuxManager = new SimpleTmuxManager(config.tmuxSessionName, this.logger, workingDir);
    this.tmuxManager.workingDir = workingDir;

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.stats = {
      startTime: new Date(),
      messagesProcessed: 0,
      commandsExecuted: 0,
      lastActivity: new Date(),
      sessionStatus: { exists: false, uptime: "未開始" },
    };

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.once("ready", async () => {
      this.logger.info(`Bot logged in as ${this.client.user?.tag}`);
      await this.initializeClaudeSession();
      this.findTargetChannel();
      
      // Wait a bit for channel to be fully resolved
      setTimeout(() => {
        this.startPendingMessageMonitor();
      }, 2000);
    });

    this.client.on("messageCreate", async (message: Message) => {
      await this.handleMessage(message);
    });

    this.client.on("error", (error) => {
      this.logger.error(`Discord client error: ${error.message}`);
    });
  }

  private async initializeClaudeSession(): Promise<void> {
    this.logger.info("Initializing Claude session...");
    
    if (!await this.tmuxManager.sessionExists()) {
      const created = await this.tmuxManager.createSession();
      if (created) {
        this.logger.info("Claude session initialized successfully");
        this.stats.sessionStatus = { exists: true, uptime: "Started" };
      } else {
        this.logger.error("Failed to initialize Claude session");
      }
    } else {
      this.logger.info("Claude session already exists");
      this.stats.sessionStatus = { exists: true, uptime: "Existing" };
    }
  }

  private findTargetChannel(): void {
    const guild = this.client.guilds.cache.get(this.config.guildId);
    if (!guild) {
      this.logger.error(`Guild not found: ${this.config.guildId}`);
      return;
    }

    const channel = guild.channels.cache.find(
      (ch) => ch.name === this.config.channelName && ch.isTextBased()
    ) as TextChannel;

    if (channel) {
      this.targetChannelId = channel.id;
      this.logger.info(`Target channel found: #${channel.name} (${channel.id})`);
    } else {
      this.logger.error(`Channel not found: ${this.config.channelName}`);
    }
  }

  private async handleMessage(message: Message): Promise<void> {
    // Skip bot messages
    if (message.author.bot) return;

    // Check if message is in target channel
    if (message.channelId !== this.targetChannelId) return;

    // Check authorization if configured
    if (this.config.authorizedUserId && message.author.id !== this.config.authorizedUserId) {
      this.logger.debug(`Unauthorized user: ${message.author.tag}`);
      return;
    }

    // Handle special commands
    if (message.content.startsWith("/")) {
      await this.handleSpecialCommand(message);
      return;
    }

    // Process regular message
    await this.processMessage(message);
  }

  private async handleSpecialCommand(message: Message): Promise<void> {
    const command = message.content.toLowerCase();

    switch (command) {
      case "/status":
        await this.sendStatus(message);
        break;
      case "/restart":
        await this.restartSession(message);
        break;
      case "/help":
        await this.sendHelp(message);
        break;
      default:
        await message.reply("Unknown command. Use `/help` for available commands.");
    }

    this.stats.commandsExecuted++;
  }

  private async processMessage(message: Message): Promise<void> {
    this.logger.info(`Processing message from ${message.author.tag}: ${message.content.substring(0, 100)}...`);
    
    try {
      // Send thinking indicator
      const thinkingMessage = await message.reply("🤔 考えています...");
      
      const startTime = Date.now();
      
      
      // Create enhanced prompt that instructs Claude to use send-to-discord command
      const enhancedPrompt = `${message.content}

重要: 実行結果や応答を以下のコマンドでDiscordに送信してください:
claude-discord-bot send-to-discord "あなたの応答内容" --session ${this.config.tmuxSessionName}`;
      
      // Send message to Claude via tmux
      const success = await this.tmuxManager.sendCommand(enhancedPrompt);
      
      if (success) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        await thinkingMessage.delete();
        await message.react('👀');
        
        // Claude will send responses using send-to-discord command
        
        this.stats.messagesProcessed++;
        this.stats.lastActivity = new Date();
      } else {
        await thinkingMessage.edit("❌ 失敗");
        await message.reply("Claude Codeへの送信に失敗しました。tmuxセッションが正常に動作しているか確認してください。");
      }
    } catch (error) {
      this.logger.error(`Error processing message: ${error}`);
      await message.reply("メッセージの処理中にエラーが発生しました。");
    }
  }

  private async sendStatus(message: Message): Promise<void> {
    const uptime = Date.now() - this.stats.startTime.getTime();
    const uptimeStr = this.formatDuration(uptime);
    const sessionExists = await this.tmuxManager.sessionExists();

    const status = `**📊 Claude Discord Bot ステータス**

**Bot情報:**
• 起動時間: ${this.stats.startTime.toLocaleString()}
• 稼働時間: ${uptimeStr}
• 最終活動: ${this.stats.lastActivity.toLocaleString()}

**処理統計:**
• 処理メッセージ数: ${this.stats.messagesProcessed}
• 実行コマンド数: ${this.stats.commandsExecuted}

**Claude セッション:**
• セッション名: ${this.config.tmuxSessionName}
• セッション状態: ${sessionExists ? "✅ 動作中" : "❌ 停止"}

**設定:**
• チャネル: #${this.config.channelName}
• ログレベル: ${this.config.logLevel}`;

    await message.reply(status);
  }

  private async restartSession(message: Message): Promise<void> {
    await message.reply("🔄 Claude セッションを再起動しています...");
    
    try {
      // Kill existing session
      const killCmd = new Deno.Command("tmux", {
        args: ["kill-session", "-t", this.config.tmuxSessionName],
      });
      await killCmd.spawn().status;

      // Create new session
      const success = await this.tmuxManager.createSession();
      
      if (success) {
        await message.reply("✅ Claude セッションが再起動されました。");
      } else {
        await message.reply("❌ セッションの再起動に失敗しました。");
      }
    } catch (error) {
      this.logger.error(`Error restarting session: ${error}`);
      await message.reply("❌ セッションの再起動中にエラーが発生しました。");
    }
  }

  private async sendHelp(message: Message): Promise<void> {
    const help = `**🤖 Claude Discord Bot ヘルプ**

**基本的な使い方:**
• このチャネルにメッセージを投稿すると、Claude Codeで実行されます
• メンションは不要です

**特殊コマンド:**
• \`/status\` - Bot・セッション状態を表示
• \`/restart\` - Claudeセッションを再起動
• \`/help\` - このヘルプを表示

**tmux直接操作:**
• \`tmux attach -t ${this.config.tmuxSessionName}\` - セッションに接続
• \`Ctrl+B → D\` - セッションから切断

**その他:**
• 認証ユーザー: ${this.config.authorizedUserId ? `<@${this.config.authorizedUserId}>` : "全ユーザー"}
• セッション名: ${this.config.tmuxSessionName}`;

    await message.reply(help);
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}日 ${hours % 24}時間`;
    if (hours > 0) return `${hours}時間 ${minutes % 60}分`;
    if (minutes > 0) return `${minutes}分 ${seconds % 60}秒`;
    return `${seconds}秒`;
  }

  async start(): Promise<void> {
    try {
      this.logger.info("Starting Claude Discord Bot...");
      await this.client.login(this.config.discordToken);
    } catch (error) {
      this.logger.error(`Failed to start bot: ${error}`);
      throw error;
    }
  }

  private pendingMessageInterval?: number;
  
  /**
   * Start monitoring for pending messages from send-to-discord command
   */
  private startPendingMessageMonitor(): void {
    const pendingFile = `/tmp/claude-discord-pending-${this.config.tmuxSessionName}.json`;
    this.logger.info(`Starting pending message monitor for: ${pendingFile}`);
    this.logger.info(`Target channel ID: ${this.targetChannelId}`);
    
    this.pendingMessageInterval = setInterval(async () => {
      try {
        const content = await Deno.readTextFile(pendingFile);
        this.logger.info(`Found pending message file, content length: ${content.length}`);
        
        const message = JSON.parse(content);
        this.logger.info(`Parsed message type: ${message.type}, has content: ${!!message.content}`);
        
        if (message && message.content && this.targetChannelId) {
          const channel = this.client.channels.cache.get(this.targetChannelId);
          this.logger.info(`Channel found: ${!!channel}, has send method: ${channel && "send" in channel}`);
          
          if (channel && "send" in channel) {
            await (channel as { send: (content: string) => Promise<unknown> }).send(message.content);
            this.logger.info("Successfully sent pending message to Discord");
          } else {
            this.logger.error("Channel not found or doesn't have send method");
          }
        } else {
          this.logger.warn(`Invalid message or missing target channel. Message: ${!!message}, Content: ${!!message?.content}, ChannelID: ${this.targetChannelId}`);
        }
        
        // Clean up the file after processing
        await Deno.remove(pendingFile);
        this.logger.info("Cleaned up pending message file");
      } catch (error) {
        // Only log if it's not a file not found error
        if (error instanceof Deno.errors.NotFound) {
          // File doesn't exist - that's normal, don't spam logs
        } else {
          this.logger.debug(`Error reading pending file: ${error}`);
        }
      }
    }, 1000); // Check every second
  }

  async stop(): Promise<void> {
    this.logger.info("Stopping Claude Discord Bot...");
    
    try {
      // Stop pending message monitor
      if (this.pendingMessageInterval) {
        clearInterval(this.pendingMessageInterval);
      }
      
      // Send shutdown message to channel if possible
      if (this.targetChannelId) {
        try {
          const channel = this.client.channels.cache.get(this.targetChannelId);
          if (channel && "send" in channel) {
            await (channel as { send: (content: string) => Promise<unknown> }).send("🔄 Claude Discord Bot をシャットダウンしています...");
          }
        } catch {
          // Ignore errors when sending shutdown message
        }
      }
      
      // Kill tmux session
      await this.tmuxManager.sessionExists() && await this.killTmuxSession();
      
      
      this.client.destroy();
      this.logger.info("Bot shutdown completed");
    } catch (error) {
      this.logger.error(`Error during shutdown: ${error}`);
    }
  }
  
  /**
   * Kill tmux session
   */
  private async killTmuxSession(): Promise<void> {
    try {
      this.logger.info(`Killing tmux session: ${this.config.tmuxSessionName}`);
      const cmd = new Deno.Command("tmux", {
        args: ["kill-session", "-t", this.config.tmuxSessionName],
      });
      await cmd.spawn().status;
      this.logger.info("Tmux session killed successfully");
    } catch (error) {
      this.logger.warn(`Failed to kill tmux session: ${error}`);
    }
  }
  
}

export class ClaudeDiscordBotCLI {
  private version = VERSION;

  async run(args: string[]): Promise<void> {
    const parsed = parseArgs(args, {
      string: ["channel", "project", "log-level", "session"],
      boolean: ["help", "version", "verbose", "global"],
      alias: {
        h: "help",
        v: "version",
        c: "channel",
        p: "project",
        s: "session",
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
        this.statusCommand();
        break;
      case "stop":
        this.stopCommand();
        break;
      case "update":
        this.updateCommand();
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
  -h, --help              Show this help
  -v, --version           Show version

${colors.yellow("EXAMPLES:")}
  claude-discord-bot init                           # Interactive setup
  claude-discord-bot init --global                  # Global setup
  claude-discord-bot start --channel dev            # Start with specific channel
  claude-discord-bot start --global                 # Start from global directory
  claude-discord-bot status                         # Check bot status
  claude-discord-bot send-to-discord "Hello world"   # Send message to Discord
`);
  }

  private async initCommand(args: {_: unknown[], global?: boolean, project?: string}): Promise<void> {
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
    const projectInfo = useGlobal ? { name: "global", language: "TypeScript" } : await this.detectProject(projectPath as string);
    await this.createConfigFiles(config, projectInfo);

    console.log(colors.green("\n✅ セットアップ完了！"));
    console.log(`\n次のステップ:`);
    console.log(`1. Discord Bot を作成して .env ファイルに設定`);
    console.log(`2. ${colors.cyan("claude-discord-bot start")} でBot起動`);
  }

  protected async detectProject(projectPath: string): Promise<{name: string, language: string, framework?: string}> {
    const packageJsonPath = join(projectPath, "package.json");
    const denoJsonPath = join(projectPath, "deno.json");
    const cargoTomlPath = join(projectPath, "Cargo.toml");
    const requirementsPath = join(projectPath, "requirements.txt");

    let projectInfo: {name: string, language: string, framework?: string} = {
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

  private detectJSFramework(packageJson: {dependencies?: Record<string, unknown>, devDependencies?: Record<string, unknown>}): string | null {
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

    // Create .env file
    const envContent = await this.generateEnvFile(config, config.projectPath);
    await Deno.writeTextFile(join(config.projectPath, ".env"), envContent);
    createdFiles.push(".env (Discord設定)");

    // Create .env.example
    const envExampleContent = await this.generateEnvExampleFile(config.projectPath);
    await Deno.writeTextFile(join(config.projectPath, ".env.example"), envExampleContent);
    createdFiles.push(".env.example (設定テンプレート)");

    console.log(`\n📄 処理されたファイル:`);
    for (const file of createdFiles) {
      console.log(`  - ${file}`);
    }
  }

  protected async generateEnvFile(config: CLIConfig, projectPath: string): Promise<string> {
    const envPath = join(projectPath as string, ".env");
    let existingContent = "";
    const existingVars = new Map<string, string>();

    // 既存の.envファイルを読み込み
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
    const envExamplePath = join(projectPath, ".env.example");
    let existingContent = "";

    // 既存の.env.exampleファイルを読み込み
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

  private async startCommand(args: {_: unknown[], global?: boolean, project?: string}): Promise<void> {
    console.log(colors.cyan("🚀 Claude Discord Bot 起動中..."));

    const projectPath = args.project || Deno.cwd();
    const envPath = join(projectPath as string, ".env");

    // Use global directory if local files don't exist or --global flag is used
    const useGlobal = args.global || !await exists(envPath);
    let configPath: string;

    if (useGlobal) {
      console.log(colors.yellow("🌐 グローバルモードで起動中..."));
      const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "/tmp";
      const globalDir = join(homeDir, ".claude-discord-bot");
      configPath = join(globalDir, ".env");
      
      if (!await exists(configPath)) {
        console.log(colors.red("❌ グローバル設定が見つかりません"));
        console.log("まず 'claude-discord-bot init --global' を実行してください");
        return;
      }
    } else {
      configPath = envPath;
      
      if (!await exists(envPath)) {
        console.log(colors.red("❌ .env ファイルが見つかりません"));
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
        console.log("設定ファイルを確認してください");
        return;
      }
    }

    // Create bot configuration
    const config: BotConfig = {
      discordToken: Deno.env.get("DISCORD_BOT_TOKEN")!,
      guildId: Deno.env.get("GUILD_ID")!,
      authorizedUserId: Deno.env.get("AUTHORIZED_USER_ID") || undefined,
      channelName: Deno.env.get("DISCORD_CHANNEL_NAME") || "claude",
      tmuxSessionName: Deno.env.get("TMUX_SESSION_NAME") || "claude-main",
      logLevel: Deno.env.get("LOG_LEVEL") || "info",
    };

    console.log(colors.green("🤖 Bot を起動しています..."));
    console.log(`📋 設定: チャネル=#${config.channelName}, セッション=${config.tmuxSessionName}`);

    try {
      // Create and start bot directly
      // Use the actual working directory where start command was executed
      const workingDir = useGlobal ? Deno.cwd() : projectPath;
      const bot = new ClaudeDiscordBot(config, workingDir as string);
      await bot.start();
      
      console.log(colors.green("✅ Bot が正常に起動しました"));
      console.log(`🔗 tmuxセッション接続: tmux attach -t ${config.tmuxSessionName}`);
      
      // Handle graceful shutdown
      const shutdown = async () => {
        console.log("\n🛑 シャットダウン中...");
        await bot.stop();
        Deno.exit(0);
      };

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

  private async sendToDiscordCommand(args: {_: unknown[], session?: string}): Promise<void> {
    const message = (args as {_: unknown[]})._[1] as string;
    const sessionName = args.session || Deno.env.get("TMUX_SESSION_NAME") || "claude-main";
    
    if (!message) {
      console.log(colors.red("❌ メッセージが指定されていません"));
      console.log("使用方法: claude-discord-bot send-to-discord \"メッセージ内容\" [--session セッション名]");
      return;
    }

    try {
      // Create temporary file with message data
      const pendingFile = `/tmp/claude-discord-pending-${sessionName}.json`;
      const messageData = {
        type: "response",
        content: message,
        timestamp: new Date().toISOString(),
      };

      await Deno.writeTextFile(pendingFile, JSON.stringify(messageData));
      console.log(colors.green(`✅ メッセージをDiscordに送信キューに追加しました: ${message.substring(0, 50)}...`));
    } catch (error) {
      console.log(colors.red(`❌ メッセージの送信に失敗しました: ${error}`));
    }
  }
}

// Main execution
if (import.meta.main) {
  const cli = new ClaudeDiscordBotCLI();
  await cli.run(Deno.args);
}