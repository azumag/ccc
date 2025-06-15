#!/usr/bin/env -S deno run --allow-all
/**
 * Claude Discord Bot CLI Tool
 * Easy installation and management for Claude Discord Bot across multiple projects
 */

import { parseArgs } from "jsr:@std/cli/parse-args";
import { load } from "jsr:@std/dotenv";
import { ensureDir, exists } from "jsr:@std/fs";
import { join, dirname } from "jsr:@std/path";
import { Input, Select, Confirm } from "https://deno.land/x/cliffy@v1.0.0-rc.3/prompt/mod.ts";
import { colors } from "https://deno.land/x/cliffy@v1.0.0-rc.3/ansi/colors.ts";

const VERSION = "1.0.0";

interface CLIConfig {
  projectPath: string;
  channelName: string;
  discordToken?: string;
  guildId?: string;
  authorizedUserId?: string;
  tmuxSessionName: string;
  logLevel: string;
}

export class ClaudeDiscordBotCLI {
  private version = VERSION;

  async run(args: string[]): Promise<void> {
    const parsed = parseArgs(args, {
      string: ["channel", "project", "log-level"],
      boolean: ["help", "version", "verbose"],
      alias: {
        h: "help",
        v: "version",
        c: "channel",
        p: "project",
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
  init     Initialize Claude Discord Bot in current project
  start    Start the bot with specified configuration  
  status   Show current bot status
  stop     Stop the running bot
  update   Update CLI tool to latest version

${colors.yellow("OPTIONS:")}
  -c, --channel <name>     Discord channel name (default: claude)
  -p, --project <path>     Project path (default: current directory)
  --log-level <level>      Log level: debug, info, warn, error
  -h, --help              Show this help
  -v, --version           Show version

${colors.yellow("EXAMPLES:")}
  claude-discord-bot init                    # Interactive setup
  claude-discord-bot start --channel dev     # Start with specific channel
  claude-discord-bot status                  # Check bot status
`);
  }

  private async initCommand(args: any): Promise<void> {
    console.log(colors.cyan("\n🤖 Claude Discord Bot セットアップ\n"));

    const projectPath = args.project || Deno.cwd();
    
    // Project detection
    const projectInfo = await this.detectProject(projectPath);
    console.log(`📁 プロジェクト: ${colors.green(projectInfo.name)}`);
    console.log(`🛠️  言語: ${colors.green(projectInfo.language)}`);
    if (projectInfo.framework) {
      console.log(`📦 フレームワーク: ${colors.green(projectInfo.framework)}`);
    }

    // Interactive configuration
    const config = await this.interactiveSetup(projectPath);

    // Create configuration files
    await this.createConfigFiles(config, projectInfo);

    console.log(colors.green("\n✅ セットアップ完了！"));
    console.log(`\n次のステップ:`);
    console.log(`1. Discord Bot を作成して .env ファイルに設定`);
    console.log(`2. ${colors.cyan("claude-discord-bot start")} でBot起動`);
  }

  protected async detectProject(projectPath: string): Promise<any> {
    const packageJsonPath = join(projectPath, "package.json");
    const denoJsonPath = join(projectPath, "deno.json");
    const cargoTomlPath = join(projectPath, "Cargo.toml");
    const requirementsPath = join(projectPath, "requirements.txt");

    let projectInfo = {
      name: "unknown-project",
      language: "unknown",
      framework: null,
      packageManager: null,
    };

    // Node.js/npm project
    if (await exists(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(await Deno.readTextFile(packageJsonPath));
        projectInfo = {
          name: packageJson.name || "nodejs-project",
          language: "JavaScript/TypeScript",
          framework: this.detectJSFramework(packageJson),
          packageManager: "npm",
        };
      } catch {
        // Ignore parsing errors
      }
    }
    // Deno project
    else if (await exists(denoJsonPath)) {
      try {
        const denoJson = JSON.parse(await Deno.readTextFile(denoJsonPath));
        projectInfo = {
          name: denoJson.name || "deno-project",
          language: "TypeScript",
          framework: null,
          packageManager: "deno",
        };
      } catch {
        // Ignore parsing errors
      }
    }
    // Rust project
    else if (await exists(cargoTomlPath)) {
      projectInfo = {
        name: "rust-project",
        language: "Rust",
        framework: null,
        packageManager: "cargo",
      };
    }
    // Python project
    else if (await exists(requirementsPath)) {
      projectInfo = {
        name: "python-project",
        language: "Python",
        framework: null,
        packageManager: "pip",
      };
    }

    return projectInfo;
  }

  private detectJSFramework(packageJson: any): string | null {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (deps.react) return "React";
    if (deps.vue) return "Vue";
    if (deps.angular) return "Angular";
    if (deps.next) return "Next.js";
    if (deps.nuxt) return "Nuxt";
    if (deps.express) return "Express";
    if (deps.fastify) return "Fastify";
    
    return null;
  }

  private async interactiveSetup(projectPath: string): Promise<CLIConfig> {
    const channelName = await Input.prompt({
      message: "Discord チャネル名:",
      default: "claude",
    });

    const tmuxSessionName = await Input.prompt({
      message: "tmux セッション名:",
      default: "claude-main",
    });

    const logLevel = await Select.prompt({
      message: "ログレベル:",
      options: ["info", "debug", "warn", "error"],
      default: "info",
    });

    const setupDiscord = await Confirm.prompt({
      message: "Discord Bot設定を今すぐ行いますか？",
      default: false,
    });

    let discordConfig = {};
    if (setupDiscord) {
      discordConfig = await this.discordSetup();
    }

    return {
      projectPath,
      channelName,
      tmuxSessionName,
      logLevel,
      ...discordConfig,
    };
  }

  private async discordSetup(): Promise<Partial<CLIConfig>> {
    console.log(colors.yellow("\n📝 Discord Bot 設定"));
    console.log("Discord Developer Portal で Bot を作成してください:");
    console.log("https://discord.com/developers/applications");

    const discordToken = await Input.prompt({
      message: "Discord Bot Token:",
      type: "password",
    });

    const guildId = await Input.prompt({
      message: "Guild (Server) ID:",
    });

    const authorizedUserId = await Input.prompt({
      message: "認証済みユーザー ID:",
    });

    return {
      discordToken,
      guildId,
      authorizedUserId,
    };
  }

  private async createConfigFiles(config: CLIConfig, projectInfo: any): Promise<void> {
    // Create .env file
    const envContent = this.generateEnvFile(config);
    await Deno.writeTextFile(join(config.projectPath, ".env"), envContent);

    // Create .env.example
    const envExampleContent = this.generateEnvExampleFile();
    await Deno.writeTextFile(join(config.projectPath, ".env.example"), envExampleContent);

    // Copy core files
    await this.copyBotFiles(config.projectPath);

    console.log(`\n📄 作成されたファイル:`);
    console.log(`  - .env (Discord設定)`);
    console.log(`  - .env.example (設定テンプレート)`);
    console.log(`  - src/bot.ts (メインBot実装)`);
    console.log(`  - src/discord-respond.ts (直接応答スクリプト)`);
    console.log(`  - deno.json (Deno設定)`);
    console.log(`  - README.md (ドキュメント)`);
  }

  protected generateEnvFile(config: CLIConfig): string {
    return `# Claude Discord Bot Configuration
DISCORD_BOT_TOKEN=${config.discordToken || "YOUR_BOT_TOKEN_HERE"}
GUILD_ID=${config.guildId || "YOUR_GUILD_ID_HERE"}
AUTHORIZED_USER_ID=${config.authorizedUserId || "YOUR_USER_ID_HERE"}
DISCORD_CHANNEL_NAME=${config.channelName}
TMUX_SESSION_NAME=${config.tmuxSessionName}
LOG_LEVEL=${config.logLevel}
`;
  }

  private generateEnvExampleFile(): string {
    return `# Claude Discord Bot Configuration Template
DISCORD_BOT_TOKEN=your_discord_bot_token_here
GUILD_ID=your_discord_guild_id_here  
AUTHORIZED_USER_ID=your_discord_user_id_here
DISCORD_CHANNEL_NAME=claude
TMUX_SESSION_NAME=claude-main
LOG_LEVEL=info
`;
  }

  private async copyBotFiles(projectPath: string): Promise<void> {
    const srcDir = join(projectPath, "src");
    await ensureDir(srcDir);

    // Import template files
    const { TEMPLATE_FILES } = await import("./templates/core-files.ts");

    // Create all template files
    for (const [relativePath, content] of Object.entries(TEMPLATE_FILES)) {
      const fullPath = join(projectPath, relativePath);
      const dir = dirname(fullPath);
      
      // Ensure directory exists
      await ensureDir(dir);
      
      // Write file content  
      await Deno.writeTextFile(fullPath, content);
      
      // Make executable if it's a script
      if (relativePath.endsWith("discord-respond.ts") || relativePath.endsWith("bot.ts")) {
        await Deno.chmod(fullPath, 0o755);
      }
    }
  }

  private async startCommand(args: any): Promise<void> {
    console.log(colors.cyan("🚀 Claude Discord Bot 起動中..."));
    
    const projectPath = args.project || Deno.cwd();
    const envPath = join(projectPath, ".env");
    
    if (!await exists(envPath)) {
      console.log(colors.red("❌ .env ファイルが見つかりません"));
      console.log("まず 'claude-discord-bot init' を実行してください");
      return;
    }

    // Load environment
    await load({ export: true, envPath });

    // Start bot (this would execute the actual bot)
    const botPath = join(projectPath, "src", "bot.ts");
    if (await exists(botPath)) {
      const cmd = new Deno.Command("deno", {
        args: ["run", "--allow-all", botPath],
        cwd: projectPath,
      });
      
      const process = cmd.spawn();
      const status = await process.status;
      
      if (!status.success) {
        console.log(colors.red("❌ Bot起動に失敗しました"));
      }
    } else {
      console.log(colors.red("❌ src/bot.ts が見つかりません"));
      console.log("Bot実装ファイルをコピーしてください");
    }
  }

  private async statusCommand(): Promise<void> {
    console.log(colors.cyan("📊 Claude Discord Bot ステータス"));
    console.log("ステータス確認機能は実装中です");
  }

  private async stopCommand(): Promise<void> {
    console.log(colors.yellow("⏹️  Claude Discord Bot 停止中..."));
    console.log("停止機能は実装中です");
  }

  private async updateCommand(): Promise<void> {
    console.log(colors.cyan("📦 CLI更新確認中..."));
    console.log("更新機能は実装中です");
  }
}

// Main execution
if (import.meta.main) {
  const cli = new ClaudeDiscordBotCLI();
  await cli.run(Deno.args);
}