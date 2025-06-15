#!/usr/bin/env -S deno run --allow-all
/**
 * Claude Discord Bot CLI Tool (Standalone Version)
 * Easy installation and management for Claude Discord Bot across multiple projects
 * This version uses full URLs for imports to work without import maps
 */

import { parseArgs } from "jsr:@std/cli/parse-args";
import { load } from "jsr:@std/dotenv";
import { ensureDir, exists } from "jsr:@std/fs";
import { dirname, join } from "jsr:@std/path";
import { Confirm, Input, Secret, Select } from "https://deno.land/x/cliffy@v1.0.0-rc.3/prompt/mod.ts";
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
      framework: null as string | null,
      packageManager: null as string | null,
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
    } // Deno project
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
    } // Rust project
    else if (await exists(cargoTomlPath)) {
      projectInfo = {
        name: "rust-project",
        language: "Rust",
        framework: null,
        packageManager: "cargo",
      };
    } // Python project
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

    const discordToken = await Secret.prompt({
      message: "Discord Bot Token:",
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

  private async createConfigFiles(config: CLIConfig, _projectInfo: any): Promise<void> {
    const createdFiles: string[] = [];

    // Create .env file
    const envContent = await this.generateEnvFile(config, config.projectPath);
    await Deno.writeTextFile(join(config.projectPath, ".env"), envContent);
    createdFiles.push(".env (Discord設定)");

    // Create .env.example
    const envExampleContent = await this.generateEnvExampleFile(config.projectPath);
    await Deno.writeTextFile(join(config.projectPath, ".env.example"), envExampleContent);
    createdFiles.push(".env.example (設定テンプレート)");

    // Create basic deno.json for Deno projects
    const denoJsonPath = join(config.projectPath, "deno.json");
    if (!await exists(denoJsonPath)) {
      const denoJsonContent = this.generateDenoJson();
      await Deno.writeTextFile(denoJsonPath, denoJsonContent);
      createdFiles.push("deno.json (Deno設定)");
    }

    console.log(`\n📄 処理されたファイル:`);
    for (const file of createdFiles) {
      console.log(`  - ${file}`);
    }
  }

  protected async generateEnvFile(config: CLIConfig, projectPath: string): Promise<string> {
    const envPath = join(projectPath, ".env");
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

  private generateDenoJson(): string {
    return `{
  "name": "claude-discord-bot-project",
  "version": "1.0.0",
  "description": "Project with Claude Discord Bot integration",
  "exports": "./src/main.ts",
  "nodeModulesDir": "auto",
  "tasks": {
    "start": "deno run --allow-all src/main.ts",
    "dev": "deno run --allow-all --watch src/main.ts",
    "claude-bot": "claude-discord-bot start"
  },
  "imports": {
    "discord.js": "npm:discord.js@14",
    "@std/dotenv": "jsr:@std/dotenv@^0.225.0"
  }
}`;
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

    console.log(colors.yellow("📦 Claude Discord Bot をダウンロード中..."));
    
    // Download and run the bot directly from GitHub (standalone version)
    const botUrl = "https://raw.githubusercontent.com/azumag/ccc/main/src/bot-standalone.ts";
    try {
      // Try to find deno executable
      let denoCmd = "deno";
      try {
        // Check if deno is in PATH
        const testCmd = new Deno.Command("which", { args: ["deno"] });
        const testResult = await testCmd.output();
        if (!testResult.success) {
          // Try common deno locations
          const possiblePaths = [
            `${Deno.env.get("HOME")}/.deno/bin/deno`,
            "/usr/local/bin/deno",
            "/opt/homebrew/bin/deno"
          ];
          
          for (const path of possiblePaths) {
            try {
              await Deno.stat(path);
              denoCmd = path;
              break;
            } catch {
              // Continue to next path
            }
          }
        }
      } catch {
        // Use default if detection fails
      }

      const cmd = new Deno.Command(denoCmd, {
        args: ["run", "--allow-all", "--reload", botUrl],
        cwd: projectPath,
      });

      console.log(colors.green("🤖 Bot を起動しています..."));
      const process = cmd.spawn();
      await process.status;
    } catch (error) {
      console.log(colors.red("❌ Bot起動に失敗しました"));
      console.log(colors.red(String(error)));
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
    console.log(colors.cyan("📦 CLI更新中..."));
    
    try {
      const cmd = new Deno.Command("deno", {
        args: [
          "install",
          "--global",
          "--allow-all",
          "-f",
          "-n",
          "claude-discord-bot",
          "https://raw.githubusercontent.com/azumag/ccc/main/cli-standalone.ts"
        ],
      });

      const process = cmd.spawn();
      const status = await process.status;

      if (status.success) {
        console.log(colors.green("✅ CLI が最新版に更新されました"));
      } else {
        console.log(colors.red("❌ 更新に失敗しました"));
      }
    } catch (error) {
      console.log(colors.red("❌ 更新に失敗しました"));
      console.log(colors.red(String(error)));
    }
  }
}

// Main execution
if (import.meta.main) {
  const cli = new ClaudeDiscordBotCLI();
  await cli.run(Deno.args);
}