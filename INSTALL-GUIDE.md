# 📦 Claude Discord Bot CLI - インストールガイド

Claude Discord Bot CLI を簡単にインストールして使用する方法をご紹介します。

## 🚀 インストール方法

### 方法1: JSR から直接インストール（推奨）

```bash
# Deno でグローバルインストール
deno install --global --allow-all jsr:@azumag/claude-discord-bot/cli

# インストール後は任意のディレクトリで使用可能
claude-discord-bot init
claude-discord-bot start
```

### 方法2: GitHub から直接インストール

```bash
# 最新版をインストール
deno install --global --allow-all -n claude-discord-bot https://raw.githubusercontent.com/azumag/ccc/main/cli.ts

# 使用方法は同じ
claude-discord-bot init
```

### 方法3: 一回限りの使用

```bash
# 一度だけ使用（インストール不要）
deno run --allow-all jsr:@azumag/claude-discord-bot/cli init

# GitHub から直接実行
deno run --allow-all https://raw.githubusercontent.com/azumag/ccc/main/cli.ts init
```

### 方法4: プログラム内での使用

```typescript
// TypeScript/JavaScript プロジェクトで使用
import { quickSetup, ClaudeDiscordBotCLI } from "jsr:@azumag/claude-discord-bot";

// 簡単セットアップ
await quickSetup("./my-project", {
  channelName: "claude-dev",
  logLevel: "debug"
});

// 詳細制御
const cli = new ClaudeDiscordBotCLI();
await cli.run(["init", "--project", "./my-project"]);
```

## ✨ 使用例

### 基本的な使い方

```bash
# 1. プロジェクトに Claude Discord Bot を追加
cd my-project
claude-discord-bot init

# 2. Discord Bot 設定を入力（対話式）
# - チャネル名: claude
# - tmux セッション名: claude-main
# - ログレベル: info
# - Discord Bot Token（オプション）

# 3. Bot を起動（依存関係も自動インストール）
claude-discord-bot start
```

### 詳細オプション

```bash
# 特定のチャネル名で起動
claude-discord-bot start --channel dev-claude

# デバッグモードで起動
claude-discord-bot start --log-level debug

# 他のプロジェクトにセットアップ
claude-discord-bot init --project /path/to/other-project

# ステータス確認
claude-discord-bot status

# ヘルプ表示
claude-discord-bot --help
```

## 🛡️ 安全性

Claude Discord Bot CLI は既存のプロジェクトを安全に扱います：

✅ **保護されるファイル**:
- `README.md` - 既存のドキュメントを保持
- `src/` - 既存のソースコードを保持
- `.env` - 既存の環境変数に追記のみ
- `.env.example` - 既存の例に追記のみ

✅ **作成されるファイル**:
- `deno.json` - Deno 設定（必要な場合のみ）
- 環境変数設定の追加

## 🔧 要件

- [Deno](https://deno.land/) 2.0+
- [tmux](https://github.com/tmux/tmux)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (認証済み)
- Discord Bot Token

## 🆘 トラブルシューティング

### PATH の設定

Deno のバイナリが PATH に含まれていない場合：

```bash
# 一時的に PATH を設定
export PATH="$HOME/.deno/bin:$PATH"

# 永続的に設定（zsh の場合）
echo 'export PATH="$HOME/.deno/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# 永続的に設定（bash の場合）
echo 'export PATH="$HOME/.deno/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### 権限エラー

```bash
# 権限が不足している場合、--allow-all を追加
deno install --global --allow-all -f jsr:@azumag/claude-discord-bot/cli
```

### 最新版への更新

```bash
# 強制的に最新版を再インストール
deno install --global --allow-all -f -n claude-discord-bot jsr:@azumag/claude-discord-bot/cli
```

## 📞 サポート

- **Issues**: [GitHub Issues](https://github.com/azumag/ccc/issues)
- **Documentation**: [GitHub README](https://github.com/azumag/ccc#readme)
- **JSR Package**: [jsr.io/@azumag/claude-discord-bot](https://jsr.io/@azumag/claude-discord-bot)

---

🎉 **Happy Coding with Claude!** 🤖