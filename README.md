# Claude Discord Bot

🤖 シンプルなチャネル監視型Discord Botで、指定したチャネルの投稿をClaude Codeに送信して実行します。

[![GitHub](https://img.shields.io/github/stars/azumag/ccc?style=social)](https://github.com/azumag/ccc)
[![Deno](https://img.shields.io/badge/deno-2.0+-green)](https://deno.land/)
[![CLI](https://img.shields.io/badge/CLI-Ready-blue)](https://github.com/azumag/ccc)
[![Docker](https://img.shields.io/badge/Docker-Supported-blue)](https://github.com/azumag/ccc/blob/main/docker-compose.yml)

## ✨ 特徴

- 🎯 **シンプル設計**: 指定チャネルの投稿を直接Claude Codeに送信
- ⚡ **高速実行**: メンション不要、投稿内容をそのまま処理
- 🔄 **永続セッション**: tmux経由でClaudeセッションを維持
- 🚀 **自動起動**: Bot起動時にClaude環境を自動準備
- 🧠 **拡張思考モード**: `--ultrathink`で詳細な分析・思考プロセス
- 🛡️ **権限フリー**: `--dangerously-permit`で制約なし
- ⚙️ **柔軟な設定**: コマンドライン引数で動作を制御
- 📊 **ステータス管理**: リアルタイムでBot状態を確認
- 🧪 **テスト対応**: 包括的なテストスイート
- 📦 **パッケージ化**: JSR/npm で簡単インストール
- 🔒 **ファイル保護**: 既存プロジェクトを安全に拡張

## 🚀 クイックスタート

### 📦 方法1: GitHubから直接インストール（推奨）

```bash
# GitHubから直接インストール
deno install --global --allow-all -n claude-discord-bot https://raw.githubusercontent.com/azumag/ccc/main/cli-standalone.ts

# プロジェクトに Claude Discord Bot を追加
cd your-project
claude-discord-bot init

# Bot を起動（依存関係も自動インストール）
claude-discord-bot start
```

### 🔄 方法2: 一時使用（インストール不要）

```bash
# 一度だけ使用
cd your-project
deno run --allow-all https://raw.githubusercontent.com/azumag/ccc/main/cli-standalone.ts init
deno run --allow-all https://raw.githubusercontent.com/azumag/ccc/main/cli-standalone.ts start
```

### 💻 方法3: 開発・カスタマイズ用

```bash
# リポジトリクローン
git clone https://github.com/azumag/ccc.git
cd ccc

# 依存関係インストール
deno install

# ローカルでビルド・インストール
deno install --global --allow-all -n claude-discord-bot ./cli.ts
```

### 🔧 前提条件

- [Deno](https://deno.land/) 2.0+
- [tmux](https://github.com/tmux/tmux)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (認証済み)
- Discord Bot Token

## ⚙️ セットアップ

### 1. Discord Bot セットアップ

1. [Discord Developer Portal](https://discord.com/developers/applications)でアプリケーション作成
2. Bot作成とトークン取得
3. **必要な権限設定**:
   - Send Messages
   - Read Message History
   - View Channels
4. **Privileged Gateway Intents有効化**:
   - ✅ Message Content Intent
5. サーバーに招待

### 2. Claude Discord Bot 初期化

```bash
# プロジェクトディレクトリで初期化（対話式）
claude-discord-bot init

# または環境変数を直接指定
claude-discord-bot init \
  --channel claude-dev \
  --log-level debug
```

初期化時に設定される環境変数：

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

### 3. PATH設定（必要に応じて）

```bash
# Denoのバイナリを PATH に追加（永続的）
echo 'export PATH="$HOME/.deno/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# または一時的に設定
export PATH="$HOME/.deno/bin:$PATH"
```

## 🚀 使用方法

### 基本的な使い方

```bash
# CLIツール使用（推奨）
# 自動的に依存関係をインストールしてから起動
claude-discord-bot start

# チャネル指定
claude-discord-bot start --channel dev-claude

# デバッグモード
claude-discord-bot start --log-level debug

# ステータス確認
claude-discord-bot status

# ヘルプ表示
claude-discord-bot --help
```

### 開発者向け（リポジトリクローン時）

```bash
# 依存関係インストール
deno install

# 直接実行
deno task start

# 開発モード（ファイル監視）
deno task dev
```

### プログラマティック使用

TypeScript/JavaScript プロジェクト内で直接使用：

```typescript
// GitHub URLから直接インポート（開発版）
import {
  ClaudeDiscordBot,
  ClaudeDiscordBotCLI,
  quickSetup,
} from "https://raw.githubusercontent.com/azumag/ccc/main/mod.ts";

// 簡単セットアップ
const config = await quickSetup("./my-project", {
  channelName: "claude-dev",
  logLevel: "debug",
  tmuxSessionName: "my-claude-session",
});

// 詳細制御
const cli = new ClaudeDiscordBotCLI();
await cli.run(["init", "--project", "./my-project"]);

// Botインスタンスの直接制御
const bot = new ClaudeDiscordBot({
  discordToken: process.env.DISCORD_BOT_TOKEN!,
  guildId: process.env.GUILD_ID!,
  authorizedUserId: process.env.AUTHORIZED_USER_ID!,
  channelName: "claude",
  tmuxSessionName: "claude-main",
  logLevel: "info",
});

await bot.start();
```

<!-- JSR公開後は以下を使用:
```typescript
import {
  quickSetup,
  ClaudeDiscordBotCLI,
  ClaudeDiscordBot
} from "jsr:@azumag/claude-discord-bot";
```
-->

### Docker実行

```bash
# 1. 環境変数準備
cp .env.example .env
# .envファイルを編集

# 2. Docker Compose起動
docker-compose up -d

# 3. ログ確認
docker-compose logs -f

# 4. tmuxセッションに接続
docker exec -it claude-discord-bot tmux attach -t claude-main

# 5. 停止
docker-compose down
```

## 💡 実際の使用例

### 基本操作

1. **自動環境準備**: Bot起動時にClaude tmuxセッションが自動作成
2. **メッセージ送信**: 指定したDiscordチャネルにメッセージを投稿
3. **自動実行**: Botが自動的にClaude Codeに送信して実行
4. **結果返信**: 実行結果が同じチャネルに返信される

### 🧠 拡張思考モードの活用

拡張思考モード（`--ultrathink`）を有効にすると、Claudeがより詳細な分析と思考プロセスを表示します：

```bash
# 拡張思考モードで起動
claude-discord-bot start --ultrathink
```

**通常モード vs 拡張思考モード:**

```
## 通常モード
👤 ユーザー: この関数を最適化して
🤖 Bot: 関数を最適化しました：[コード]

## 拡張思考モード  
👤 ユーザー: この関数を最適化して
🤖 Bot: 💭 *この関数の現在の実装を分析しています...*
💭 *パフォーマンスのボトルネックを特定中...*
💭 *メモリ使用量とアルゴリズム効率を検討...*
💭 *最適化案を複数検討して最良の手法を選択...*

関数を以下の観点で最適化しました：
1. アルゴリズム効率: O(n²) → O(n log n)
2. メモリ使用量: 中間配列を削除して30%削減
3. 可読性: より明確な変数名と構造

[最適化されたコード]
```

### 🔄 進捗レポート機能

長時間実行されるタスクの進捗を定期的にDiscordに報告する機能です。

#### 基本的な使い方

```bash
# 進捗レポートを有効化（デフォルト1分間隔）
claude-discord-bot start --progress-update

# カスタム間隔で進捗レポート
claude-discord-bot start --progress-update --progress-interval 30s
claude-discord-bot start --progress-update --progress-interval 2m
claude-discord-bot start --progress-update --progress-interval 5m
```

#### 時間指定フォーマット

| フォーマット | 説明     | 例          |
| ------------ | -------- | ----------- |
| `30s`        | 秒単位   | 30秒間隔    |
| `2m`         | 分単位   | 2分間隔     |
| `1h`         | 時間単位 | 1時間間隔   |
| `90s`        | 90秒間隔 | 1分30秒間隔 |

#### 進捗レポートの例

```
# 長時間タスクの実行例
👤 ユーザー: 全ファイルの型チェックとテストを実行して

🤖 Bot: 🤔 考えています...

# 1分後の進捗レポート
🤖 Bot: 📊 進捗: 型チェック完了、テストファイル発見 - 15/30ファイル処理済み

# 2分後の進捗レポート  
🤖 Bot: 📊 進捗: テスト実行中 - 8/12テストスイート完了、2件のエラーを修正

# 最終結果
🤖 Bot: ✅ 完了 (3.2m)
全ての型チェックとテストが完了しました：
- 型エラー: 0件
- テスト結果: 45/45 passed
- 修正したエラー: 3件
```

#### 有効な場面

- **大規模リファクタリング**: 複数ファイルの変更進捗
- **テスト実行**: 長時間のテストスイート実行
- **ビルド・デプロイ**: 時間のかかるビルドプロセス
- **データ移行**: 大量データの処理進捗
- **複雑な解析**: コードベース全体の分析

### 実際の使用例

#### 1. React開発

````
Discord (#dev-channel):
👤 ユーザー: ログイン機能付きのReactコンポーネントを作って

🤖 Bot: 🤔 考えています...
🤖 Bot: ✅ 完了 (4.1s)

🤖 Bot: ログイン機能付きのReactコンポーネントを作成しました：

```jsx
// src/components/LoginForm.tsx
import React, { useState } from 'react';

interface LoginFormProps {
  onLogin: (email: string, password: string) => void;
  loading?: boolean;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin, loading = false }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(email, password);
  };

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <div className="form-group">
        <label htmlFor="email">メール:</label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="password">パスワード:</label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <button type="submit" disabled={loading}>
        {loading ? 'ログイン中...' : 'ログイン'}
      </button>
    </form>
  );
};

export default LoginForm;
````

対応するCSSファイルも作成しました：

```css
/* src/components/LoginForm.css */
.login-form {
  max-width: 400px;
  margin: 0 auto;
  padding: 2rem;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
}

.form-group input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

button {
  width: 100%;
  padding: 0.75rem;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}
```

```
#### 2. API作成
```

Discord (#backend):
👤 ユーザー: Express.jsでユーザー認証APIを作って

🤖 Bot: 🤔 考えています...
🤖 Bot: ✅ 完了 (6.8s)

🤖 Bot: Express.jsでユーザー認証APIを作成しました：

```typescript
// src/routes/auth.ts
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models/User";

const router = express.Router();

// ユーザー登録
router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // バリデーション
    if (!email || !password || !name) {
      return res.status(400).json({ error: "すべてのフィールドが必要です" });
    }

    // 既存ユーザーチェック
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "ユーザーは既に存在します" });
    }

    // パスワードハッシュ化
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // ユーザー作成
    const user = new User({
      email,
      password: hashedPassword,
      name,
    });

    await user.save();

    // JWTトークン生成
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: "24h" },
    );

    res.status(201).json({
      message: "ユーザーが正常に作成されました",
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "内部サーバーエラー" });
  }
});

// ログイン
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // バリデーション
    if (!email || !password) {
      return res.status(400).json({ error: "メールとパスワードが必要です" });
    }

    // ユーザー検索
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "無効な認証情報です" });
    }

    // パスワード検証
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "無効な認証情報です" });
    }

    // JWTトークン生成
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: "24h" },
    );

    res.json({
      message: "ログイン成功",
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "内部サーバーエラー" });
  }
});

export default router;
```

追加で認証ミドルウェアも作成しました：

```typescript
// src/middleware/auth.ts
import jwt from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "アクセストークンが必要です" });
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "無効なトークンです" });
    }

    req.user = decoded as { userId: string; email: string };
    next();
  });
};
```

```
#### 3. バグ修正
```

Discord (#debugging):
👤 ユーザー: TypeScriptでnullエラーが出てる。この関数を直して：

```typescript
function getUserName(user) {
  return user.profile.name.toUpperCase();
}
```

🤖 Bot: 🤔 考えています...
🤖 Bot: ✅ 完了 (2.3s)

🤖 Bot: TypeScriptの型安全性を考慮してnullエラーを修正しました：

```typescript
interface UserProfile {
  name?: string;
}

interface User {
  profile?: UserProfile;
}

function getUserName(user: User | null | undefined): string {
  // nullチェックとオプショナルチェーンを使用
  if (!user?.profile?.name) {
    return "UNKNOWN USER";
  }

  return user.profile.name.toUpperCase();
}

// より安全な代替案（Optionalパターン使用）
function getUserNameSafe(user: User | null | undefined): string {
  try {
    return user?.profile?.name?.toUpperCase() ?? "UNKNOWN USER";
  } catch (error) {
    console.warn("getUserName error:", error);
    return "UNKNOWN USER";
  }
}

// 使用例
const user1: User = { profile: { name: "john doe" } };
const user2: User = { profile: {} };
const user3: User = {};

console.log(getUserName(user1)); // "JOHN DOE"
console.log(getUserName(user2)); // "UNKNOWN USER"
console.log(getUserName(user3)); // "UNKNOWN USER"
console.log(getUserName(null)); // "UNKNOWN USER"
```

修正のポイント：

1. **型定義の追加**: インターフェースで構造を明確化
2. **オプショナルチェーン**: `?.`でnullエラーを防止
3. **Nullish Coalescing**: `??`でデフォルト値を設定
4. **エラーハンドリング**: try-catch文で予期しないエラーをキャッチ

````
## 🛠️ CLI コマンドリファレンス

### 基本コマンド

```bash
# 初期設定（対話式）
claude-discord-bot init

# 特定のプロジェクトに設定
claude-discord-bot init --project /path/to/project

# Bot起動（依存関係も自動インストール）
claude-discord-bot start

# 特定のチャネルで起動
claude-discord-bot start --channel dev-claude

# デバッグモードで起動
claude-discord-bot start --log-level debug

# 拡張思考モードで起動
claude-discord-bot start --ultrathink

# 権限バイパスで起動
claude-discord-bot start --dangerously-permit

# 進捗レポート機能を有効化
claude-discord-bot start --progress-update

# 進捗レポート間隔をカスタマイズ
claude-discord-bot start --progress-update --progress-interval 30s

# オプションを組み合わせ
claude-discord-bot start --ultrathink --dangerously-permit --progress-update

# ステータス確認
claude-discord-bot status

# Bot停止
claude-discord-bot stop

# CLI更新
claude-discord-bot update

# ヘルプ表示
claude-discord-bot --help

# バージョン表示
claude-discord-bot --version
````

### オプション

| オプション                   | 短縮 | 説明                     | デフォルト         |
| ---------------------------- | ---- | ------------------------ | ------------------ |
| `--channel <name>`           | `-c` | Discord チャネル名       | `claude`           |
| `--project <path>`           | `-p` | プロジェクトパス         | 現在のディレクトリ |
| `--global`                   |      | グローバル設定を使用     | `false`            |
| `--session <name>`           | `-s` | tmuxセッション名         | `claude-main`      |
| `--log-level <level>`        |      | ログレベル               | `info`             |
| `--ultrathink`               |      | 拡張思考モード有効化     | `false`            |
| `--dangerous-permit`         |      | Claude権限バイパス有効化 | `false`            |
| `--progress-update`          |      | 進捗レポート機能有効化   | `false`            |
| `--progress-interval <time>` |      | 進捗レポート間隔         | `1m`               |
| `--help`                     | `-h` | ヘルプ表示               |                    |
| `--version`                  | `-v` | バージョン表示           |                    |

### 一回限り実行

```bash
# インストール不要で一度だけ実行
deno run --allow-all https://raw.githubusercontent.com/azumag/ccc/main/cli-standalone.ts init
deno run --allow-all https://raw.githubusercontent.com/azumag/ccc/main/cli-standalone.ts start

# JSR公開後（準備中）:
# deno run --allow-all jsr:@azumag/claude-discord-bot/cli init
```

### Discord特殊コマンド

| コマンド   | 説明                         |
| ---------- | ---------------------------- |
| `/restart` | Claudeセッションを再起動     |
| `/status`  | Bot・セッション状態を表示    |
| `/attach`  | tmuxセッション接続方法を表示 |
| `/help`    | 利用可能なコマンド一覧       |

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

# ローカルビルドとインストール
/Users/azumag/.deno/bin/deno compile --allow-all --output ./bin/claude-discord-bot cli.ts
/Users/azumag/.deno/bin/deno install --global --allow-all --config deno.json -f -n claude-discord-bot cli.ts
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

**5. "deno: not found"エラー（CLI使用時）**

PATHが設定されていない場合:

```bash
# 永続的に設定
echo 'export PATH="$HOME/.deno/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# 一時的に設定
export PATH="$HOME/.deno/bin:$PATH"
```

**6. Enterキーが送信されない問題**

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

| 変数名                 | 必須 | デフォルト    | 説明               |
| ---------------------- | ---- | ------------- | ------------------ |
| `DISCORD_BOT_TOKEN`    | ✅   | -             | Discord Bot Token  |
| `GUILD_ID`             | ✅   | -             | Discord Server ID  |
| `AUTHORIZED_USER_ID`   | ✅   | -             | 認証ユーザーID     |
| `DISCORD_CHANNEL_NAME` |      | `claude`      | 監視対象チャネル名 |
| `TMUX_SESSION_NAME`    |      | `claude-main` | tmuxセッション名   |
| `LOG_LEVEL`            |      | `info`        | ログレベル         |

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

## 🛡️ 安全性とファイル保護

Claude Discord Bot CLI は既存プロジェクトの安全性を最優先に設計されています：

### ✅ 保護されるファイル・ディレクトリ

- **`README.md`** - 既存のドキュメントは完全に保護
- **`src/` ディレクトリ** - 既存のソースコードには一切手を加えない
- **既存の `.env`** - 環境変数に追記のみ、既存設定は保持
- **既存の `.env.example`** - テンプレートに追記のみ

### ➕ 作成・更新されるファイル

- **`deno.json`** - 必要な場合のみ作成（Node.js プロジェクトでは作成しない）
- **環境変数の追加** - Claude Discord Bot 用の設定のみ追記

### 🔄 初期化時の動作

```bash
claude-discord-bot init

# 実行時の出力例:
# ⏭️  Skipping src/bot.ts (src files are not modified)
# ⏭️  Skipping README.md (file already exists)
# 📄 処理されたファイル:
#   - .env (Discord設定)
#   - .env.example (設定テンプレート)  
#   - deno.json (Deno設定)
```

## 🔒 セキュリティ

- **環境変数**: 機密情報は`.env`ファイルで管理
- **Git除外**: `.gitignore`で機密情報を除外
- **作業範囲制限**: プロジェクトディレクトリ内での作業
- **ユーザー認証**: 特定ユーザーIDで認証（オプション）
- **権限スキップ**: Claude実行時の権限チェック無効化

## 🚀 デプロイ

### Docker (推奨)

#### Dockerfile作成

```dockerfile
FROM denoland/deno:2.0.5-alpine

# Install tmux
RUN apk add --no-cache tmux

WORKDIR /app

# Copy dependency files
COPY deno.json deno.lock* ./

# Cache dependencies
RUN deno cache --reload src/bot.ts

# Copy source code
COPY . .

# Install CLI tool
RUN deno install --global --allow-all -n claude-discord-bot ./cli.ts

# Add deno bin to PATH
ENV PATH="/root/.deno/bin:$PATH"

# Create volume for project data
VOLUME ["/app/project"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD claude-discord-bot status || exit 1

# Default command
CMD ["claude-discord-bot", "start"]
```

#### docker-compose.yml

```yaml
version: "3.8"

services:
  claude-discord-bot:
    build: .
    container_name: claude-discord-bot
    restart: unless-stopped
    environment:
      - DISCORD_BOT_TOKEN=${DISCORD_BOT_TOKEN}
      - GUILD_ID=${GUILD_ID}
      - AUTHORIZED_USER_ID=${AUTHORIZED_USER_ID}
      - DISCORD_CHANNEL_NAME=${DISCORD_CHANNEL_NAME:-claude}
      - TMUX_SESSION_NAME=${TMUX_SESSION_NAME:-claude-main}
      - LOG_LEVEL=${LOG_LEVEL:-info}
    volumes:
      - ./project:/app/project # プロジェクトファイル用
      - ./logs:/app/logs # ログファイル用
    networks:
      - claude-network
    # tmux用の疑似TTY
    tty: true
    stdin_open: true

networks:
  claude-network:
    driver: bridge

volumes:
  project_data:
  log_data:
```

#### Docker実行コマンド

```bash
# 環境変数ファイル準備
cp .env.example .env
# .envファイルを編集

# ビルドと起動
docker-compose up -d

# ログ確認
docker-compose logs -f claude-discord-bot

# tmuxセッションに接続
docker exec -it claude-discord-bot tmux attach -t claude-main

# ステータス確認
docker exec claude-discord-bot claude-discord-bot status

# 停止
docker-compose down
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
Environment=PATH=/home/bot/.deno/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/home/bot/.deno/bin/claude-discord-bot start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: claude-discord-bot
  labels:
    app: claude-discord-bot
spec:
  replicas: 1
  selector:
    matchLabels:
      app: claude-discord-bot
  template:
    metadata:
      labels:
        app: claude-discord-bot
    spec:
      containers:
        - name: claude-discord-bot
          image: claude-discord-bot:latest
          env:
            - name: DISCORD_BOT_TOKEN
              valueFrom:
                secretKeyRef:
                  name: claude-bot-secrets
                  key: discord-token
            - name: GUILD_ID
              value: "your-guild-id"
            - name: AUTHORIZED_USER_ID
              value: "your-user-id"
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          volumeMounts:
            - name: project-storage
              mountPath: /app/project
      volumes:
        - name: project-storage
          persistentVolumeClaim:
            claimName: claude-project-pvc
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

## 💡 ベストプラクティス

### Claudeとの効果的なやり取り

#### 1. 明確な指示を出す

```
❌ 悪い例: "何かいい感じにして"
✅ 良い例: "TypeScriptでAPIエラーハンドリングを実装して。ステータスコード、エラーメッセージ、ログ出力を含める"
```

#### 2. コンテキストを提供する

```
❌ 悪い例: "この関数を直して"
✅ 良い例: "React Hook useEffectでAPIを呼び出すこの関数で、依存配列が原因で無限ループが発生している。修正して：
[コードを貼り付け]"
```

#### 3. 要求する出力形式を指定

```
✅ 良い例: "Express.jsでREST APIを作って。以下の要件で：
- TypeScript使用
- エラーハンドリング付き
- OpenAPI仕様書も生成
- テストコードも含める"
```

### プロジェクト管理のコツ

#### 1. 作業単位を明確にする

```bash
# 機能ごとにディレクトリ分け
Discord (#feature-auth): "認証機能を実装して"
Discord (#feature-api): "ユーザー管理APIを作って"
Discord (#bugfix): "この型エラーを修正して"
```

#### 2. 段階的な開発

```
段階1: "基本的なログイン画面を作って"
段階2: "バリデーション機能を追加して"
段階3: "エラーハンドリングを改善して"
段階4: "テストコードを書いて"
```

### セキュリティベストプラクティス

- **機密情報の分離**: 環境変数で管理
- **権限制限**: 必要最小限の権限のみ
- **ログ監視**: 重要な操作をログ記録
- **定期的な更新**: 依存関係の脆弱性チェック

## ❓ FAQ

### Q: Discordでメッセージを送ったのに反応しない

**A**: 以下を確認してください：

- Botが正しいチャネルを監視しているか（`/status`で確認）
- tmuxセッションが起動しているか（`tmux list-sessions`）
- Claude Code CLIが認証されているか（`claude --version`）

### Q: tmuxセッションに接続できない

**A**:

```bash
# セッション一覧確認
tmux list-sessions

# セッション強制作成
claude-discord-bot restart

# または手動作成
tmux new-session -d -s claude-main -c $(pwd)
```

### Q: コンテナ内でtmuxが動かない

**A**: docker-compose.ymlで以下を設定：

```yaml
services:
  claude-discord-bot:
    tty: true
    stdin_open: true
```

### Q: Claude Codeの応答が長すぎてDiscordで送信できない

**A**: Botが自動的に2000文字で分割して送信します。分割を避けたい場合：

```
"簡潔な説明で結果を返して"
"要点のみを箇条書きで"
```

### Q: 複数のプロジェクトで使いたい

**A**: プロジェクトごとに異なるチャネルを使用：

```bash
# プロジェクト1
claude-discord-bot start --channel project1-dev

# プロジェクト2  
claude-discord-bot start --channel project2-dev
```

### Q: ログが多すぎる

**A**: ログレベルを調整：

```bash
# 本番環境
LOG_LEVEL=warn claude-discord-bot start

# 開発環境
LOG_LEVEL=debug claude-discord-bot start
```

### Q: パフォーマンスを向上させたい

**A**:

- SSDでの実行を推奨
- メモリ1GB以上推奨
- tmuxセッションの定期的な再起動

```bash
# 毎日午前2時に再起動（crontab例）
0 2 * * * claude-discord-bot restart
```

### Q: 拡張思考モードはいつ使うべき？

**A**: 以下の場面で特に有効です：

- 複雑なアルゴリズムの最適化
- アーキテクチャ設計の検討
- バグの詳細な分析
- コードレビューでの詳細説明

### Q: 権限バイパスは安全？

**A**: `--dangerously-permit`は以下の場合に使用：

- サンドボックス環境での実行
- 完全に制御された環境
- プロトタイプ開発時
  本番環境では使用を避けてください。

### Q: 他のAIモデルを使いたい

**A**: 現在はClaude Code専用です。将来的に他のモデル対応予定。

### Q: 複数人で同じBotを使いたい

**A**: `AUTHORIZED_USER_ID`を削除するか、認証機能を無効化：

```typescript
// src/bot.ts - 認証チェックを削除
// if (message.author.id !== this.config.authorizedUserId) return;
```

### Q: プライベートなコードを扱っても安全？

**A**:

- ローカル実行なので外部送信なし
- Discord APIのみ通信
- tmuxセッションはローカル環境内
- 機密ファイルは`.gitignore`で除外推奨

## 📞 サポート

- **Issues**: GitHub Issues
- **Claude Code**: [公式ドキュメント](https://docs.anthropic.com/en/docs/claude-code)
- **Discord.js**: [公式ドキュメント](https://discord.js.org/)
- **Deno**: [公式ドキュメント](https://docs.deno.com/)
