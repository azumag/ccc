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

### 5. CLIツールインストール（推奨）

```bash
# CLIツールをグローバルインストール
deno install --global --allow-all -n claude-discord-bot ./cli.ts

# PATHに追加（永続的）
echo 'export PATH="/Users/$USER/.deno/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# または一時的に設定
export PATH="$HOME/.deno/bin:$PATH"
```

### 6. 起動

#### ローカル実行

```bash
# CLIツール使用（推奨）
# 自動的に依存関係をインストールしてから起動
claude-discord-bot start

# チャネル指定
claude-discord-bot start --channel dev-claude

# デバッグモード
claude-discord-bot start --log-level debug

# または直接実行（事前に依存関係をインストール）
deno install
deno task start
```

#### Docker実行

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

## 💡 使用方法

### 基本操作

1. **自動環境準備**: Bot起動時にClaude tmuxセッションが自動作成
2. **メッセージ送信**: 指定したDiscordチャネルにメッセージを投稿
3. **自動実行**: Botが自動的にClaude Codeに送信して実行
4. **結果返信**: 実行結果が同じチャネルに返信される

### 実際の使用例

#### 1. React開発

```
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
```

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
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

const router = express.Router();

// ユーザー登録
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // バリデーション
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'すべてのフィールドが必要です' });
    }

    // 既存ユーザーチェック
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'ユーザーは既に存在します' });
    }

    // パスワードハッシュ化
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // ユーザー作成
    const user = new User({
      email,
      password: hashedPassword,
      name
    });

    await user.save();

    // JWTトークン生成
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'ユーザーが正常に作成されました',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: '内部サーバーエラー' });
  }
});

// ログイン
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // バリデーション
    if (!email || !password) {
      return res.status(400).json({ error: 'メールとパスワードが必要です' });
    }

    // ユーザー検索
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: '無効な認証情報です' });
    }

    // パスワード検証
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: '無効な認証情報です' });
    }

    // JWTトークン生成
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'ログイン成功',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '内部サーバーエラー' });
  }
});

export default router;
```

追加で認証ミドルウェアも作成しました：

```typescript
// src/middleware/auth.ts
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'アクセストークンが必要です' });
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: '無効なトークンです' });
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
    return 'UNKNOWN USER';
  }
  
  return user.profile.name.toUpperCase();
}

// より安全な代替案（Optionalパターン使用）
function getUserNameSafe(user: User | null | undefined): string {
  try {
    return user?.profile?.name?.toUpperCase() ?? 'UNKNOWN USER';
  } catch (error) {
    console.warn('getUserName error:', error);
    return 'UNKNOWN USER';
  }
}

// 使用例
const user1: User = { profile: { name: 'john doe' } };
const user2: User = { profile: {} };
const user3: User = {};

console.log(getUserName(user1)); // "JOHN DOE"
console.log(getUserName(user2)); // "UNKNOWN USER"
console.log(getUserName(user3)); // "UNKNOWN USER"
console.log(getUserName(null));  // "UNKNOWN USER"
```

修正のポイント：
1. **型定義の追加**: インターフェースで構造を明確化
2. **オプショナルチェーン**: `?.`でnullエラーを防止
3. **Nullish Coalescing**: `??`でデフォルト値を設定
4. **エラーハンドリング**: try-catch文で予期しないエラーをキャッチ
```

### CLIコマンド

```bash
# 初期設定（対話式）
claude-discord-bot init

# Bot起動
claude-discord-bot start

# ステータス確認
claude-discord-bot status

# Bot停止
claude-discord-bot stop

# ヘルプ表示
claude-discord-bot --help
```

### Discord特殊コマンド

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
version: '3.8'

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
      - ./project:/app/project  # プロジェクトファイル用
      - ./logs:/app/logs        # ログファイル用
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