# Claude Discord Bot

シンプルなチャネル監視型Discord Botで、指定したチャネルの投稿をClaude Codeに送信して実行します。

## ✨ 特徴

- 🎯 **シンプル設計**: 指定チャネルの投稿を直接Claude Codeに送信
- ⚡ **高速実行**: メンション不要、投稿内容をそのまま処理
- 🔄 **永続セッション**: tmux経由でClaudeセッションを維持
- 🚀 **自動起動**: Bot起動時にClaude環境を自動準備
- 🛡️ **権限フリー**: `--dangerously-skip-permissions`で制約なし
- 📊 **ステータス管理**: リアルタイムでBot状態を確認
- 🧪 **テスト対応**: 包括的なテストスイート

## 🚀 クイックスタート

### 1. 前提条件

- [Deno](https://deno.land/) 2.0+
- [tmux](https://github.com/tmux/tmux)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (認証済み)
- Discord Bot Token

### 2. インストール

```bash
# リポジトリクローン
git clone <repository-url>
cd claude-discord-bot

# 環境変数設定
cp .env.example .env
# .envファイルを編集して必要な値を設定
```

### 3. 環境変数設定

`.env`ファイルに以下を設定:

```bash
# Discord設定
DISCORD_BOT_TOKEN=your_discord_bot_token
GUILD_ID=your_discord_server_id
AUTHORIZED_USER_ID=your_discord_user_id

# チャネル設定
DISCORD_CHANNEL_NAME=claude

# tmuxセッション設定
TMUX_SESSION_NAME=claude-main

# ログレベル (debug, info, warn, error)
LOG_LEVEL=info
```

### 4. Discord Bot セットアップ

1. [Discord Developer Portal](https://discord.com/developers/applications)でアプリケーション作成
2. Bot作成とトークン取得
3. **必要な権限設定**:
   - Send Messages
   - Read Message History
   - View Channels
4. **Privileged Gateway Intents有効化**:
   - ✅ Message Content Intent
5. サーバーに招待

### 5. 起動

```bash
# 基本起動
deno task start

# チャネル名指定
deno run --allow-all src/bot.ts --channel dev-claude

# デバッグモード
deno run --allow-all src/bot.ts --channel claude --log-level debug
```

## 💡 使用方法

### 基本操作

1. **自動環境準備**: Bot起動時にClaude tmuxセッションが自動作成
2. **メッセージ送信**: 指定したDiscordチャネルにメッセージを投稿
3. **自動実行**: Botが自動的にClaude Codeに送信して実行
4. **結果返信**: 実行結果が同じチャネルに返信される

```
Discord (#claude):
ユーザー: Reactコンポーネントを作って

Bot: 🤔 考えています...
Bot: ✅ 完了 (3.2s)
Bot: ```jsx
import React from 'react';

const MyComponent = () => {
  return (
    <div>
      <h1>Hello, World!</h1>
    </div>
  );
};

export default MyComponent;
```

### 特殊コマンド

| コマンド | 説明 |
|---------|------|
| `/restart` | Claudeセッションを再起動 |
| `/status` | Bot・セッション状態を表示 |
| `/attach` | tmuxセッション接続方法を表示 |
| `/help` | 利用可能なコマンド一覧 |

### tmuxセッション直接操作

```bash
# セッションに接続（Claude Code画面を直接操作）
tmux attach -t claude-main

# セッション切断
Ctrl+B → D
```

## 🏗️ アーキテクチャ

```
Discord Channel (#claude)
        ↓ (メッセージ投稿)
Discord Bot (ClaudeDiscordBot)
        ↓ (tmux send-keys + Enter)
tmux session (claude-main)
        ↓ (claude --dangerously-skip-permissions)
Claude Code (単一ペイン)
        ↓ (プロジェクト内ファイル操作)
Discord Channel (結果返信)
```

### 技術スタック

- **Runtime**: Deno 2.0+
- **Discord API**: Discord.js v14
- **セッション管理**: tmux
- **AI実行**: Claude Code CLI
- **言語**: TypeScript

## 🔧 開発

### プロジェクト構造

```
src/
├── bot.ts           # メインBotクラス
├── types.ts         # TypeScript型定義
├── tmux.ts          # tmuxセッション管理
├── claude.ts        # Claude Code実行インターフェース
├── logger.ts        # ロガー実装
└── utils.ts         # ユーティリティ関数

tests/
├── bot.test.ts      # Botテスト
├── tmux.test.ts     # tmux管理テスト
├── claude.test.ts   # Claude実行テスト
├── utils.test.ts    # ユーティリティテスト
├── logger.test.ts   # ロガーテスト
└── integration.test.ts  # 統合テスト

deno.json            # Deno設定・依存関係
.env.example         # 環境変数テンプレート
```

### 開発用コマンド

```bash
# 開発モード（ファイル監視）
deno task dev

# テスト実行
deno task test

# コード整形
deno task fmt

# Lint実行
deno task lint

# 型チェック
deno task check
```

### テスト

```bash
# 全テスト実行
deno test --allow-all tests/

# 特定テストファイル
deno test --allow-all tests/bot.test.ts

# 統合テスト（tmux・Claude必要）
deno test --allow-all tests/integration.test.ts
```

## 📊 ログとモニタリング

### ログレベル

- `debug`: 詳細なデバッグ情報（tmuxコマンド実行詳細含む）
- `info`: 一般的な動作情報
- `warn`: 警告メッセージ
- `error`: エラーメッセージ

### 状態確認

```bash
# Discordでステータス確認
/status

# tmuxセッション直接確認
tmux attach -t claude-main

# セッション一覧
tmux list-sessions

# セッション出力確認
tmux capture-pane -t claude-main -p
```

## 🛠️ トラブルシューティング

### よくある問題

**1. "tmux is not available"エラー**

```bash
# macOS
brew install tmux

# Ubuntu/Debian
sudo apt install tmux
```

**2. "Claude Code CLI is not available"エラー**

```bash
# Claude Code CLIインストール・認証
# https://docs.anthropic.com/en/docs/claude-code

# 認証確認
claude --version
```

**3. "Used disallowed intents"エラー**

Discord Developer Portal で以下を有効化:
- ✅ Message Content Intent

**4. "Guild not found"エラー**

- Discord botがサーバーに招待されているか確認
- `GUILD_ID`が正確か確認
- Bot権限でサーバーが見えるか確認

**5. Enterキーが送信されない問題**

- ログレベルを`debug`に設定して詳細確認
- tmuxセッションを直接確認
- Bot再起動で新しいセッション作成

### デバッグ

```bash
# 詳細ログでデバッグ
LOG_LEVEL=debug deno task start

# tmuxセッション詳細確認
tmux list-sessions
tmux list-panes -t claude-main
tmux capture-pane -t claude-main -p

# 手動セッション作成テスト
tmux new-session -d -s test-claude -c $(pwd)
tmux send-keys -t test-claude "claude --dangerously-skip-permissions" Enter
```

## ⚙️ 設定オプション

### 環境変数

| 変数名 | 必須 | デフォルト | 説明 |
|--------|------|-----------|------|
| `DISCORD_BOT_TOKEN` | ✅ | - | Discord Bot Token |
| `GUILD_ID` | ✅ | - | Discord Server ID |
| `AUTHORIZED_USER_ID` | ✅ | - | 認証ユーザーID |
| `DISCORD_CHANNEL_NAME` | | `claude` | 監視対象チャネル名 |
| `TMUX_SESSION_NAME` | | `claude-main` | tmuxセッション名 |
| `LOG_LEVEL` | | `info` | ログレベル |

### コマンドライン引数

```bash
# チャネル名指定
--channel dev-claude

# ログレベル指定
--log-level debug

# ヘルプ表示
--help

# バージョン表示
--version
```

## 🔒 セキュリティ

- **環境変数**: 機密情報は`.env`ファイルで管理
- **Git除外**: `.gitignore`で機密情報を除外
- **作業範囲制限**: プロジェクトディレクトリ内での作業
- **ユーザー認証**: 特定ユーザーIDで認証（オプション）
- **権限スキップ**: Claude実行時の権限チェック無効化

## 🚀 デプロイ

### Docker (推奨)

```dockerfile
FROM denoland/deno:alpine

WORKDIR /app
COPY . .
RUN deno cache src/bot.ts

CMD ["deno", "task", "start"]
```

### systemd

```ini
[Unit]
Description=Claude Discord Bot
After=network.target

[Service]
Type=simple
User=bot
WorkingDirectory=/opt/claude-discord-bot
ExecStart=/usr/local/bin/deno task start
Restart=always

[Install]
WantedBy=multi-user.target
```

## 📝 ライセンス

MIT License

## 🤝 コントリビューション

1. フォークしてブランチ作成
2. 変更を実装
3. テスト追加・実行
4. プルリクエスト作成

### 開発ガイドライン

- TypeScript使用
- Deno標準ライブラリ優先
- 包括的なテスト記述
- コードフォーマット・Lint実行

## 📞 サポート

- **Issues**: GitHub Issues
- **Claude Code**: [公式ドキュメント](https://docs.anthropic.com/en/docs/claude-code)
- **Discord.js**: [公式ドキュメント](https://discord.js.org/)
- **Deno**: [公式ドキュメント](https://docs.deno.com/)