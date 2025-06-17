# Claude Discord Bot CLI

別のリポジトリでも簡単にCllaude Discord Botを使えるようにするCLIツールです。

## 🚀 インストール

```bash
# Denoを使用してインストール
deno install --allow-all -n claude-discord-bot https://raw.githubusercontent.com/azumag/ccc/main/cli.ts

# または、ローカルファイルから
deno install --allow-all -n claude-discord-bot ./cli.ts
```

## 📋 使用方法

### 1. 初期化（対話式）

```bash
# プロジェクトディレクトリで実行
claude-discord-bot init

# 指定されたディレクトリで実行
claude-discord-bot init --project /path/to/project
```

**実行内容：**

- プロジェクトの自動検出（言語・フレームワーク）
- Discord設定の対話式入力
- 必要ファイルの自動生成

### 2. 生成されるファイル

```
your-project/
├── .env                    # Discord認証情報
├── .env.example           # 設定テンプレート
├── deno.json              # Deno設定
├── README.md              # ドキュメント
└── src/
    ├── bot.ts             # メインBot実装
    └── discord-respond.ts # 直接応答スクリプト
```

### 3. Bot起動

```bash
# Discord Botを起動
claude-discord-bot start

# 特定チャネルで起動
claude-discord-bot start --channel dev-claude
```

## 🔧 設定

### Discord Bot作成

1. [Discord Developer Portal](https://discord.com/developers/applications) でBot作成
2. Bot TokenをコピーしてFAST_URL_GET_VALUEに設定
3. Guild ID (サーバーID) を取得
4. 認証済みユーザーIDを設定

### 環境変数

```env
DISCORD_BOT_TOKEN=your_bot_token_here
GUILD_ID=your_guild_id_here
AUTHORIZED_USER_ID=your_user_id_here
DISCORD_CHANNEL_NAME=claude
TMUX_SESSION_NAME=claude-main
LOG_LEVEL=info
```

## 📊 コマンド一覧

```bash
# セットアップ
claude-discord-bot init                    # 対話式初期化
claude-discord-bot init --project path    # 指定パスで初期化

# 実行制御
claude-discord-bot start                   # Bot起動
claude-discord-bot start --channel dev     # チャネル指定起動
claude-discord-bot stop                    # Bot停止
claude-discord-bot status                  # ステータス確認

# メンテナンス
claude-discord-bot update                  # CLI更新
claude-discord-bot --help                  # ヘルプ表示
claude-discord-bot --version               # バージョン表示
```

## 🎯 特徴

### 自動プロジェクト検出

- **Node.js**: package.json から React, Vue, Express等を検出
- **Deno**: deno.json から設定を読み込み
- **Rust**: Cargo.toml から情報を取得
- **Python**: requirements.txt から依存関係を確認

### 対話式セットアップ

- Discord設定の段階的入力
- プロジェクトに応じた最適な設定
- 設定ファイルの自動生成

### テンプレートベース

- 完全なBot実装をテンプレートから生成
- プロジェクトに応じたカスタマイズ
- 即座に使用可能な状態で出力

## 💡 使用例

### 新規プロジェクト

```bash
mkdir my-new-project
cd my-new-project
claude-discord-bot init
# → 対話式セットアップ完了
claude-discord-bot start
```

### 既存プロジェクト

```bash
cd existing-project
claude-discord-bot init
# → 既存設定を検出して最適化
claude-discord-bot start --channel dev-claude
```

## 🔒 セキュリティ

- 環境変数での認証情報管理
- .env ファイルの自動生成
- 認証済みユーザーの制限
- tmux セッション分離

## 🛠️ 開発

### 前提条件

- Deno 1.40+
- tmux (セッション管理)
- Claude Code CLI (認証済み)

### ローカル開発

```bash
# CLIテスト
./cli.ts --help

# 非対話テスト
./test-non-interactive.ts
```

## 📝 ライセンス

MIT License

## 🤝 貢献

Issues・PRは歓迎です！
