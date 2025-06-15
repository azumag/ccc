# @azumag/claude-discord-bot

🤖 **Claude Discord Bot CLI** - 任意のプロジェクトに簡単に Claude Discord Bot を追加できる CLI ツール

[![JSR](https://jsr.io/badges/@azumag/claude-discord-bot)](https://jsr.io/@azumag/claude-discord-bot)
[![GitHub](https://img.shields.io/github/stars/azumag/ccc?style=social)](https://github.com/azumag/ccc)

## ✨ 特徴

- 🎯 **簡単セットアップ**: 対話式でプロジェクトに Claude Discord Bot を追加
- 🔄 **ファイル保護**: 既存の README.md や src/ ディレクトリを上書きしない
- ⚡ **自動依存関係**: 必要なパッケージを自動インストール
- 🐳 **Docker サポート**: コンテナでの実行にも対応
- 🛡️ **型安全**: TypeScript で書かれた完全型安全な実装

## 🚀 インストール

### 方法1: JSR から直接インストール（推奨）

```bash
# Deno ユーザー
deno install --global --allow-all jsr:@azumag/claude-discord-bot/cli

# 使用例
claude-discord-bot init
claude-discord-bot start
```

### 方法2: 一時使用

```bash
# 一度だけ使用
deno run --allow-all jsr:@azumag/claude-discord-bot/cli init

# または npx スタイル
npx --yes jsr:@azumag/claude-discord-bot init
```

### 方法3: プログラム内で使用

```typescript
import { quickSetup, ClaudeDiscordBotCLI } from "jsr:@azumag/claude-discord-bot";

// 簡単セットアップ
await quickSetup("./my-project", {
  channelName: "claude-dev",
  logLevel: "debug"
});

// または詳細制御
const cli = new ClaudeDiscordBotCLI();
await cli.run(["init", "--project", "./my-project"]);
```

## 💡 使用方法

### 基本的な使い方

```bash
# プロジェクトに Claude Discord Bot を追加
claude-discord-bot init

# Bot を起動（依存関係も自動インストール）
claude-discord-bot start

# 特定のチャネル名で起動
claude-discord-bot start --channel dev-claude

# ステータス確認
claude-discord-bot status
```

### 対話式セットアップ

`claude-discord-bot init` を実行すると、以下の設定を対話的に行えます：

- Discord チャネル名
- tmux セッション名
- ログレベル
- Discord Bot 設定（オプション）

### 既存プロジェクトでの安全性

✅ **保護されるファイル**:
- `README.md` - 既存のドキュメントを保持
- `src/` - 既存のソースコードを保持
- `.env` - 既存の環境変数に追記のみ
- `.env.example` - 既存の例に追記のみ

✅ **作成されるファイル**:
- `deno.json` - Deno 設定（必要な場合のみ）
- 環境変数設定の追加

## 🛠️ 開発者向け

### プログラマティック API

```typescript
import { 
  ClaudeDiscordBotCLI,
  ClaudeDiscordBot,
  TmuxSessionManager,
  quickSetup 
} from "jsr:@azumag/claude-discord-bot";

// 高速セットアップ
const config = await quickSetup("./project", {
  channelName: "ai-dev",
  logLevel: "debug"
});

// カスタム CLI インスタンス
const cli = new ClaudeDiscordBotCLI();
await cli.run(["init", "--project", "./custom-project"]);

// Bot インスタンスの直接制御
const bot = new ClaudeDiscordBot({
  discordToken: process.env.DISCORD_BOT_TOKEN!,
  guildId: process.env.GUILD_ID!,
  // ...他の設定
});
```

### TypeScript サポート

完全な型定義が含まれています：

```typescript
import type { 
  BotConfig, 
  BotStats, 
  LogLevel,
  ProjectContext 
} from "jsr:@azumag/claude-discord-bot";

const config: BotConfig = {
  discordToken: "...",
  guildId: "...",
  logLevel: "info" as LogLevel,
  // ...
};
```

## 📚 詳細ドキュメント

完全なドキュメントとサンプルは [GitHub リポジトリ](https://github.com/azumag/ccc) をご覧ください。

## 🔧 要件

- [Deno](https://deno.land/) 2.0+
- [tmux](https://github.com/tmux/tmux)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (認証済み)
- Discord Bot Token

## 📞 サポート

- **Issues**: [GitHub Issues](https://github.com/azumag/ccc/issues)
- **Documentation**: [README](https://github.com/azumag/ccc#readme)
- **Claude Code**: [公式ドキュメント](https://docs.anthropic.com/en/docs/claude-code)

## 📝 ライセンス

MIT License - 詳細は [LICENSE](https://github.com/azumag/ccc/blob/main/LICENSE) をご覧ください。

---

Made with ❤️ by [azumag](https://github.com/azumag)