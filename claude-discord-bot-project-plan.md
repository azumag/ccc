# Claude Code Discord Bot プロジェクト計画書

## 📋 プロジェクト概要

### プロジェクト名

**Personal Claude Code Discord Controller**

### 目的

個人のDiscordサーバーからローカルのClaude Codeをコントロールし、開発作業を効率化する

### 対象ユーザー

**個人利用**（開発者本人のみ）

---

## 🎯 プロジェクトゴール

### 主要目標

1. Discord経由でローカルClaude Codeを操作
2. スレッドベースのセッション管理システム
3. 個人開発ワークフローの大幅改善

### 成功指標

- [ ] Discord メンション → Claude Code実行の成功率 95%以上
- [ ] スレッド単位でのセッション管理機能
- [ ] レスポンス時間 30秒以内
- [ ] 個人作業での日常的な活用

---

## 🏗️ システム設計

### 基本アーキテクチャ

```
指定Discord Channel
     ↓ (メッセージ投稿)
Discord Bot (プロジェクトディレクトリで起動)
     ↓ (tmux経由)
Claude Code (同一ディレクトリ実行 + --dangerously-skip-permissions)
     ↓ (プロジェクト内ファイル操作)
Discord Channel (レスポンス投稿)
```

### プロジェクト単位管理

- **起動場所**: Gitリポジトリルート（または任意のプロジェクトディレクトリ）
- **作業範囲**: 起動ディレクトリ配下のファイルのみ
- **安全性**: プロジェクト外ファイルへのアクセス制限
- **コンテキスト**: プロジェクト固有の設定・履歴管理

### 使用方法

#### プロジェクト開始

```bash
# プロジェクトディレクトリに移動
cd /path/to/your-project

# Bot起動（チャネル名を指定）
deno run --allow-all bot.ts --channel "dev-claude"
# または環境変数で指定
DISCORD_CHANNEL_NAME="dev-claude" deno task start

# プロジェクト情報自動検出
# - package.json, requirements.txt, Cargo.toml等
# - .git リポジトリ情報
# - プロジェクト固有設定ファイル
```

#### 作業範囲の制限

- **安全な範囲**: `./` 配下のファイルのみアクセス可能
- **禁止範囲**: `../` での親ディレクトリアクセス禁止
- **システム保護**: `/etc/`, `/usr/` 等のシステムディレクトリアクセス不可

### 核心アイデア：シンプルなチャネル監視

#### チャネル監視設計

1. **Bot起動時にチャネル名指定** → 該当チャネルを監視
2. **チャネル投稿** → そのまま Claude Code に送信
3. **Claude応答** → 同じチャネルに返信
4. **単一tmuxセッション** → プロジェクト全体で1つのClaudeセッション

#### メリット

- 🎯 **シンプル**: 複雑なセッション管理が不要
- ⚡ **高速**: スレッド作成などのオーバーヘッドなし
- 🔧 **直感的**: チャネル投稿 = Claude指示の明確な関係
- 🏠 **プロジェクト固有**: 起動ディレクトリのコンテキスト維持
- 🛡️ **安全**: --dangerously-skip-permissions で権限チェック無効化

---

## 🛠️ 技術仕様

### プログラミング言語

**Deno (TypeScript)** - 選択理由：

- モダンで安全なランタイム
- NPMパッケージのネイティブサポート
- 標準ライブラリの充実
- 依存関係管理の簡素化
- デフォルトでTypeScript対応

### 主要ライブラリ（CLI呼び出し版）

```typescript
// deno.json
{
  "imports": {
    "discord.js": "npm:discord.js@^14.x",
    "dotenv": "https://deno.land/std@0.208.0/dotenv/mod.ts"
  },
  "tasks": {
    "start": "deno run --allow-net --allow-read --allow-write --allow-env --allow-run bot.ts",
    "dev": "deno run --allow-net --allow-read --allow-write --allow-env --allow-run --watch bot.ts"
  },
  "permissions": {
    "net": true,
    "read": true,
    "write": true,
    "env": true,
    "run": true  // Claude Code CLI実行のため必須
  }
}
```

**注意**: Claude Code SDKは不要。CLI版のみ使用するため依存関係がシンプルになります。

````
### Claude Code統合方式（tmux経由）
```typescript
// bot.ts
import { Client, GatewayIntentBits } from "npm:discord.js@^14";
import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";

// tmux経由でClaude Code実行（単一永続セッション）
async function executeClaudeCodeInTmux(prompt: string, projectRoot: string) {
  const sessionName = "claude-main";
  
  // tmuxセッションが存在するかチェック
  const hasSession = await checkTmuxSession(sessionName);
  
  if (!hasSession) {
    // 新規tmuxセッション作成してclaudeを起動
    await createTmuxSessionWithClaude(sessionName, projectRoot);
  }
  
  // プロンプトをtmuxセッションに送信
  const command = new Deno.Command("tmux", {
    args: [
      "send-keys", "-t", sessionName,
      prompt, "Enter"
    ],
    cwd: projectRoot,
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await command.output();
  
  if (code !== 0) {
    const errorText = new TextDecoder().decode(stderr);
    throw new Error(`tmux command failed: ${errorText}`);
  }
  
  // Claudeの応答を取得（tmuxの出力バッファから）
  return await getTmuxOutput(sessionName);
}

async function checkTmuxSession(sessionName: string): Promise<boolean> {
  const command = new Deno.Command("tmux", {
    args: ["has-session", "-t", sessionName],
    stdout: "piped",
    stderr: "piped",
  });
  const { code } = await command.output();
  return code === 0;
}

async function createTmuxSessionWithClaude(sessionName: string, projectRoot: string): Promise<void> {
  // tmuxセッション作成
  const createSession = new Deno.Command("tmux", {
    args: ["new-session", "-d", "-s", sessionName, "-c", projectRoot],
    stdout: "piped",
    stderr: "piped",
  });
  await createSession.output();
  
  // claudeコマンドを--dangerously-skip-permissionsで起動
  const startClaude = new Deno.Command("tmux", {
    args: ["send-keys", "-t", sessionName, "claude --dangerously-skip-permissions", "Enter"],
    stdout: "piped",
    stderr: "piped",
  });
  await startClaude.output();
  
  // 起動を少し待つ
  await new Promise(resolve => setTimeout(resolve, 2000));
}

async function getTmuxOutput(sessionName: string): Promise<string> {
  // tmuxペインの出力内容を取得
  const command = new Deno.Command("tmux", {
    args: ["capture-pane", "-t", sessionName, "-p"],
    stdout: "piped",
    stderr: "piped",
  });
  
  const { code, stdout } = await command.output();
  
  if (code !== 0) {
    throw new Error("Failed to capture tmux output");
  }
  
  const output = new TextDecoder().decode(stdout);
  return parseClaude Output(output);
}

function parseClaudeOutput(rawOutput: string): string {
  // tmuxの出力からClaudeの応答部分を抽出
  const lines = rawOutput.split('\n');
  // Claudeのプロンプト（❯）以降の内容を抽出
  let capturing = false;
  const claudeResponse: string[] = [];
  
  for (const line of lines) {
    if (line.includes('❯') && !capturing) {
      capturing = true;
      continue;
    }
    if (capturing && line.includes('❯')) {
      break; // 次のプロンプトで終了
    }
    if (capturing) {
      claudeResponse.push(line);
    }
  }
  
  return claudeResponse.join('\n').trim();
}

// シンプルなtmuxセッション管理
class SimpleTmuxManager {
  private sessionName = "claude-main";
  private lastActivity = new Date();
  
  updateActivity() {
    this.lastActivity = new Date();
  }
  
  async clearSession(): Promise<boolean> {
    // メインのClaudeセッションを終了
    const command = new Deno.Command("tmux", {
      args: ["kill-session", "-t", this.sessionName],
      stdout: "piped",
      stderr: "piped",
    });
    
    try {
      await command.output();
      return true;
    } catch {
      return false;
    }
  }
  
  async restartSession(projectRoot: string): Promise<boolean> {
    // 既存セッションを終了してから再作成
    await this.clearSession();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      await createTmuxSessionWithClaude(this.sessionName, projectRoot);
      return true;
    } catch {
      return false;
    }
  }
  
  async getSessionStatus(): Promise<{ exists: boolean; uptime: string }> {
    const exists = await checkTmuxSession(this.sessionName);
    const uptime = exists 
      ? Math.floor((Date.now() - this.lastActivity.getTime()) / 1000 / 60) + "分前"
      : "停止中";
    
    return { exists, uptime };
  }
}
````

### 単一tmuxセッションでの継続利用

```bash
# プロジェクト開始時に1つのセッション作成
tmux new-session -d -s "claude-main" -c "/project/path"
tmux send-keys -t "claude-main" "claude --dangerously-skip-permissions" Enter

# Discord投稿1: Reactコンポーネントを作って
tmux send-keys -t "claude-main" "Reactコンポーネントを作って" Enter

# Discord投稿2: そのコンポーネントにpropsを追加して
tmux send-keys -t "claude-main" "そのコンポーネントにpropsを追加して" Enter

# Discord投稿3: バックエンドAPIを作って
tmux send-keys -t "claude-main" "バックエンドAPIを作って" Enter

# セッション確認
tmux has-session -t "claude-main"

# セッション終了
tmux kill-session -t "claude-main"

# セッション内容を直接確認（デバッグ用）
tmux attach -t "claude-main"
```

### プロジェクト設定（Deno版）

```yaml
# .claude/project.yml（オプション）
name: "My Awesome Project"
language: "typescript"
framework: "deno"
excluded_dirs:
  - .git
  - dist
  - build
coding_standards: "./docs/coding-standards.md"
```

---

## 📋 機能仕様

### 基本フロー

#### 1. チャネル投稿による指示

```
ユーザー: (指定チャネルに投稿) このReactコンポーネントをリファクタリングして
↓
Bot: チャネルメッセージを検出
↓
Claude Code: tmuxセッション経由で実行
↓
Bot: 同じチャネルにレスポンス投稿
```

#### 2. 継続会話

```
ユーザー: (同じチャネルに投稿) TypeScriptも対応してください
↓
Bot: チャネルメッセージを検出
↓
Claude Code: 同じtmuxセッションで継続実行
↓
Bot: 同じチャネルにレスポンス投稿
```

### 詳細機能

#### セッション管理

- **単一セッション**: プロジェクトごとに1つのtmuxセッション
- **自動起動**: Botの初回メッセージ受信時にClaudeセッション作成
- **手動リセット**: `/restart` コマンドでセッション再起動
- **ステータス確認**: `/status` コマンドでセッション状態表示

#### レスポンス表示

- **コードブロック**: 自動フォーマット適用
- **長文対応**: 2000文字制限を考慮した分割投稿
- **進捗表示**: 長時間処理時の状況表示
- **エラー表示**: 分かりやすいエラーメッセージ

#### チャネル監視

- **指定チャネル専用**: 起動時に指定したチャネルのみ監視
- **全メッセージ処理**: メンション不要、投稿内容をそのまま指示として処理
- **権限スキップ**: --dangerously-skip-permissions で安全制約を無効化

#### 特殊コマンド

````typescript
// /restart コマンドでtmuxセッション再起動
if (message.content.startsWith("/restart")) {
  const restarted = await this.tmuxManager.restartSession(this.projectContext.rootPath);
  await message.reply(
    restarted ? "✅ Claudeセッションを再起動しました" : "❌ 再起動に失敗しました",
  );
  return;
}

// /status コマンドで現在の状態表示
if (message.content.startsWith("/status")) {
  const status = await this.tmuxManager.getSessionStatus();
  await message.reply(
    `📊 **プロジェクト**: ${this.projectContext.projectName}\n📁 **パス**: ${this.projectContext.rootPath}\n🔄 **Claudeセッション**: ${
      status.exists ? "起動中" : "停止中"
    }\n⏰ **最終活動**: ${status.uptime}`,
  );
  return;
}

// /attach コマンドでtmuxセッション接続方法表示
if (message.content.startsWith("/attach")) {
  await message.reply(
    "🔧 **tmuxセッションに直接接続**:\n```bash\ntmux attach -t claude-main\n```\n**注意**: 接続中はBotからの操作ができません",
  );
  return;
}
````

---

## 🎨 ユーザーエクスペリエンス

### 使用例

#### ケース1: プロジェクト内コードレビュー

```
# プロジェクトディレクトリで Bot起動（チャネル指定）
cd ~/projects/my-web-app
deno run --allow-all bot.ts --channel "dev-claude"

Discord (#dev-claude):
src/components/UserForm.tsx をレビューして

→ プロジェクト固有の設定を考慮した詳細レビュー
→ 同プロジェクト内の他ファイルとの整合性チェック
→ 同チャネルにレビュー結果投稿
```

#### ケース2: 機能追加

```
Discord (#dev-claude):
ユーザー認証機能を追加してください

→ プロジェクト構造を理解した適切なファイル配置提案
→ 既存のルーティング、状態管理との統合を考慮
→ プロジェクト内のテストパターンに合わせたテスト作成
→ 同チャネルに実装結果投稿
```

#### ケース3: バグ修正（継続セッション）

```
Discord (#dev-claude):
User: api/users.ts でエラーが発生してます
Bot: [ファイル内容確認 → 問題箇所特定 → 修正提案]
User: テストも更新して
Bot: [関連テストファイル確認 → テスト更新]
User: 他の影響範囲も調べて
Bot: [プロジェクト全体の依存関係チェック → 影響分析]
```

---

## 🔧 実装詳細

### Discord Bot設定（CLI版）

````typescript
// types.ts
interface ProjectContext {
  rootPath: string;
  projectName: string;
  language: string;
  framework?: string;
  gitRepo?: string;
}

interface ThreadSession {
  threadId: string;
  sessionId: string;
  createdAt: Date;
  lastActivity: Date;
  topic: string;
}

// bot.ts
import { Client, GatewayIntentBits, Message, ThreadChannel } from "npm:discord.js@^14";
import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";

class ClaudeDiscordBot {
  private tmuxManager = new SimpleTmuxManager();
  private projectContext: ProjectContext;
  private client: Client;
  private targetChannelId: string;
  
  constructor(channelName: string) {
    this.projectContext = this.detectProjectContext();
    this.targetChannelId = ""; // 起動後にチャネル名から解決
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
    
    this.setupEventHandlers();
    this.resolveTargetChannel(channelName);
  }
  
  private setupEventHandlers() {
    this.client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      if (message.channel.id !== this.targetChannelId) return;
      
      await this.handleChannelMessage(message);
    });
  }
  
  private async resolveTargetChannel(channelName: string) {
    this.client.on('ready', () => {
      const guild = this.client.guilds.cache.first();
      const channel = guild?.channels.cache.find(ch => ch.name === channelName);
      if (channel) {
        this.targetChannelId = channel.id;
        console.log(`🎯 監視対象チャネル: #${channelName} (${channel.id})`);
      } else {
        console.error(`❌ チャネル '${channelName}' が見つかりません`);
      }
    });
  }
  
  private async handleChannelMessage(message: Message) {
    const prompt = message.content.trim();
    
    // 特殊コマンドチェック
    if (await this.handleSpecialCommands(message, prompt)) {
      return;
    }
    
    // 通常のClaude Code実行
    await this.executeAndRespond(message, prompt);
  }
  
  private async handleSpecialCommands(message: Message, prompt: string): Promise<boolean> {
    // /restart コマンド
    if (prompt.startsWith('/restart')) {
      const restarted = await this.tmuxManager.restartSession(this.projectContext.rootPath);
      await message.reply(restarted ? '✅ Claudeセッションを再起動しました' : '❌ 再起動に失敗しました');
      return true;
    }
    
    // /status コマンド
    if (prompt.startsWith('/status')) {
      const status = await this.tmuxManager.getSessionStatus();
      await message.reply(`📊 **プロジェクト**: ${this.projectContext.projectName}\n📁 **パス**: ${this.projectContext.rootPath}\n🔄 **Claudeセッション**: ${status.exists ? '起動中' : '停止中'}\n⏰ **最終活動**: ${status.uptime}`);
      return true;
    }
    
    // /attach コマンド
    if (prompt.startsWith('/attach')) {
      await message.reply('🔧 **tmuxセッションに直接接続**:\n```bash\ntmux attach -t claude-main\n```\n**注意**: 接続中はBotからの操作ができません');
      return true;
    }
    
    return false;
  }
  
  private async executeAndRespond(message: Message, prompt: string) {
    try {
      // 処理中メッセージ
      const thinking = await message.reply("🤔 考えています...");
      
      // tmux経由でClaude Code実行
      const result = await executeClaudeCodeInTmux(prompt, this.projectContext.rootPath);
      
      // レスポンス送信
      await thinking.edit("✅ 完了");
      await this.sendFormattedResponse(message.channel, result);
      
      // セッション活動時刻更新
      this.tmuxManager.updateActivity();
      
    } catch (error) {
      await message.reply(`❌ エラーが発生しました: ${error.message}`);
    }
  }
  
  // Bot起動のメインメソッド
  async start() {
    await this.client.login(Deno.env.get('DISCORD_BOT_TOKEN'));
    console.log(`🤖 Claude Discord Bot started in project: ${this.projectContext.projectName}`);
  }
}

// Bot起動用のメイン関数
async function main() {
  const channelName = Deno.args[1] || Deno.env.get('DISCORD_CHANNEL_NAME') || 'claude';
  
  if (Deno.args[0] === '--channel') {
    const bot = new ClaudeDiscordBot(channelName);
    await bot.start();
  } else {
    console.error('使用方法: deno run --allow-all bot.ts --channel <チャネル名>');
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
}
````

---

## 🔐 セキュリティ・設定

### 環境設定（tmux版）

```bash
# 1. 必要ツールのインストール
# tmux インストール（各OS固有）
# macOS:
brew install tmux

# Ubuntu/Debian:
sudo apt install tmux

# 2. Claude Code CLI インストール（グローバル）
npm install -g @anthropic-ai/claude-code

# 3. Claude Code認証
claude  # 初回実行時にOAuth認証

# 4. プロジェクト設定
# .env（プロジェクトルートに配置）
DISCORD_BOT_TOKEN=your_bot_token
GUILD_ID=your_personal_server_id
AUTHORIZED_USER_ID=your_discord_user_id

# ANTHROPIC_API_KEYは claude コマンドが自動で利用
```

### 実行方法

```bash
# プロジェクトディレクトリに移動
cd /path/to/your-project

# Deno権限付きで実行
deno run --allow-net --allow-read --allow-write --allow-env --allow-run bot.ts

# または deno.json の tasks を使用
deno task start
deno task dev  # 開発時（--watch付き）
```

### シンプル実行フロー

```
Discord Channel Message
     ↓ (指定チャネルのみ)
Deno Bot
     ↓ (tmux session check)
tmux has-session -t claude-main
     ↓ (if not exists)
tmux new-session -d -s claude-main
tmux send-keys -t claude-main "claude --dangerously-skip-permissions" Enter
     ↓ (send prompt)
tmux send-keys -t claude-main "prompt" Enter
     ↓ (capture output)
tmux capture-pane -t claude-main -p
     ↓ (parse Claude response)
Deno Bot (parseClaudeOutput)
     ↓
Discord Channel (formatted response)
```

---

## 💡 拡張アイデア

### Phase 2機能

1. **tmuxセッション拡張**
   - セッション間でのファイル共有
   - マルチペイン対応（ログ表示用など）
   - セッション永続化設定
   - セッション復旧機能（ボット再起動時）

2. **プロジェクト深度理解**
   - 依存関係グラフの自動生成
   - アーキテクチャパターンの認識
   - コーディング規約の自動適用

3. **マルチプロジェクト対応**
   - 複数プロジェクト間でのBot切り替え
   - プロジェクト固有設定の管理
   - プロジェクト横断的な知識の活用

### Phase 3機能

1. **tmux統合機能**
   - tmux設定の自動最適化
   - セッション監視・自動復旧
   - ログ出力の構造化
   - セッション統計情報

2. **開発ワークフロー統合**
   - テスト自動実行
   - ビルド状況の監視
   - CI/CD連携

3. **プロジェクト分析**
   - コード品質メトリクス
   - 技術的負債の検出
   - リファクタリング提案

---

## 📊 期待される効果

### 開発効率向上

- **永続セッション**: tmuxによりボット再起動時もコンテキスト維持
- **プロジェクト文脈理解**: 関連ファイル・設定を考慮した提案
- **安全な作業環境**: プロジェクト外への意図しない影響防止
- **履歴管理**: Discordスレッドでの作業ログ自動保存
- **継続的改善**: 同一プロジェクト内での学習効果

### ワークフロー統合

- **シームレス操作**: Discord ↔ ローカル開発環境
- **セッション管理の簡素化**: `claude -p`のセッション管理が不要
- **プロジェクト固有最適化**: 各プロジェクトの特性に応じた支援
- **リアルタイム監視**: tmuxによりClaudeの動作状況を直接確認可能

## 🎯 開始手順（Deno版）

### 1. 基本セットアップ

```bash
# 1. Deno インストール（まだの場合）
curl -fsSL https://deno.land/install.sh | sh

# 2. Claude Code CLI インストール
npm install -g @anthropic-ai/claude-code

# 3. プロジェクトに移動
cd /path/to/your-project

# 4. プロジェクト初期化
# deno.json 作成
# .env ファイル作成
# bot.ts 作成

# 5. Discord Bot作成・設定
# Discord Developer Portalでアプリケーション作成
```

### 2. プロジェクトファイル作成

```typescript
// deno.json
{
  "imports": {
    "discord.js": "npm:discord.js@^14",
    "dotenv": "https://deno.land/std@0.208.0/dotenv/mod.ts"
  },
  "tasks": {
    "start": "deno run --allow-all bot.ts"
  }
}

// .env
DISCORD_BOT_TOKEN=your_bot_token
GUILD_ID=your_server_id
AUTHORIZED_USER_ID=your_user_id

// bot.ts (基本構造)
import { Client, GatewayIntentBits } from "npm:discord.js@^14";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent
  ]
});

client.on('messageCreate', async (message) => {
  if (message.mentions.has(client.user)) {
    // Claude Code呼び出し処理
  }
});

await client.login(Deno.env.get('DISCORD_BOT_TOKEN'));
```

### 3. Bot起動・テスト

```bash
# Bot起動
deno task start

# 初回テスト
Discord: @Bot プロジェクト構造を教えて
→ 現在のプロジェクト情報表示で動作確認

Discord: @Bot deno.json の内容を確認して
→ プロジェクト内ファイルアクセス確認
```

### 4. 本格活用

- 日常的な開発作業での利用開始
- スレッド単位での作業整理
- Denoプロジェクトの継続的改善

---

## 💡 Denoのメリット

### 🔒 セキュリティ

- デフォルトで権限制限
- 実行時権限の明示的指定
- 安全なファイルシステムアクセス

### 🚀 開発効率

- TypeScript標準サポート
- NPMパッケージのシームレス利用
- 依存関係管理の簡素化
- 標準ライブラリの充実

### 🛠️ 運用面

- 単一バイナリでの配布
- Webスタンダード準拠
- 高いパフォーマンス

**tmux統合により、より安定で永続的なClaude Code Discord Botが実現できます！**

## 🔄 tmuxアプローチのメリット

### 🚀 パフォーマンス向上

- **プロセス再利用**: Claudeプロセスを使い回すことで起動時間短縮
- **メモリ効率**: セッション間でのリソース共有
- **ネットワーク最適化**: 認証済みセッションの再利用

### 🛡️ 安定性向上

- **プロセス分離**: 各スレッドが独立したtmuxセッション
- **障害隔離**: 一つのセッションの問題が他に影響しない
- **自動復旧**: tmuxセッションの永続性による耐障害性

### 🔧 運用面の改善

- **デバッグ容易性**: `tmux attach`で直接セッション確認可能
- **手動介入**: 必要に応じて直接tmuxセッションを操作
- **ログ管理**: tmuxの履歴機能によるセッション記録
