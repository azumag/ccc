# Claude Code Discord/Slack Bot 開発計画書

## 📋 プロジェクト概要

### プロジェクト名

**Claude Code Multi-Platform Bot Controller**

### 目的

個人のDiscord/SlackからローカルのClaude Codeをコントロールし、開発作業を効率化する統合ボットシステム

### 開発アプローチ

段階的開発（Discord優先 → Slack対応追加）

---

## 📊 認証・登録の複雑さ分析

### Discord Bot 登録 ⭐⭐☆☆☆ (難易度: 低-中)

**所要時間: 15-20分**

#### 手順詳細:

1. **Discord Developer Portal でアプリケーション作成**
   - https://discord.com/developers/applications にアクセス
   - "New Application" をクリック
   - アプリケーション名を入力して作成

2. **Bot設定**
   - "Bot" タブに移動
   - "Add Bot" をクリック
   - Public Bot をチェック（他人が招待可能にする場合）
   - "Require OAuth2 Code Grant" をオフにする

3. **OAuth2 URL生成**
   - "OAuth2" タブ → "URL Generator"
   - Scopes: `bot` + `applications.commands` を選択
   - Bot Permissions: 必要な権限を選択
     - Send Messages
     - Read Message History
     - Manage Messages
     - Create Public Threads
     - Send Messages in Threads

4. **サーバーに招待**
   - 生成されたURLにアクセス
   - 対象サーバーを選択（Manage Server権限必要）
   - "Authorize" をクリック

#### メリット:

- ✅ シンプルな設定手順
- ✅ 永続的なOAuth2 URL
- ✅ 権限システムが明確
- ✅ スレッド機能がネイティブサポート

---

### Slack Bot 登録 ⭐⭐⭐☆☆ (難易度: 中)

**所要時間: 20-30分**

#### 手順詳細:

1. **Slack APIでアプリ作成**
   - https://api.slack.com/apps にアクセス
   - "Create New App" → "From scratch"
   - App Name とワークスペースを選択

2. **OAuth & Permissions設定**
   - "OAuth & Permissions" に移動
   - Bot Token Scopes を追加:
     - `chat:write` - メッセージ送信
     - `channels:read` - パブリックチャンネル読み取り
     - `app_mentions:read` - メンション検知
     - `im:read` - DMアクセス
     - `im:write` - DM送信

3. **ワークスペースにインストール**
   - "Install to Workspace" をクリック
   - 権限を確認して "Allow"
   - Bot User OAuth Token を取得・保存

4. **Event Subscriptions設定**
   - "Event Subscriptions" を有効化
   - Request URL を設定（botのエンドポイント）
   - Subscribe to bot events:
     - `app_mention` - メンション検知
     - `message.im` - DM検知

#### 注意点:

- ⚠️ 2024年6月からレガシーbot廃止
- ⚠️ Events API必須 (RTM API廃止)
- ⚠️ より細かい権限管理が必要
- ⚠️ Webhook URLの設定が必要

#### メリット:

- ✅ 企業での利用に適している
- ✅ 豊富なAPI機能
- ✅ 細かい権限制御

---

## 🚀 段階的開発計画

### Phase 1: Discord Bot基本実装 ⏱️ 2-3日

**優先度: 最高**

#### 実装内容:

- [x] プロジェクト基盤セットアップ (Deno + TypeScript)
- [ ] Discord.js v14統合
- [ ] スレッドベースセッション管理
- [ ] Claude Code CLI統合
- [ ] 基本的なメンション検知・応答
- [ ] エラーハンドリング

#### 成果物:

- 動作するDiscord Bot
- セッション管理システム
- Claude Code統合機能

---

### Phase 2: Slack対応追加 ⏱️ 1-2日

**優先度: 高**

#### 実装内容:

- [ ] @slack/bolt-js統合
- [ ] 統一インターフェース設計
- [ ] Slack Events API対応
- [ ] プラットフォーム切り替え機能
- [ ] 共通セッション管理拡張

#### 成果物:

- Slack Bot機能
- マルチプラットフォーム対応
- 統一された設定管理

---

### Phase 3: 統合・最適化 ⏱️ 1日

**優先度: 中**

#### 実装内容:

- [ ] 共通設定ファイル
- [ ] ログ機能強化
- [ ] パフォーマンス最適化
- [ ] ドキュメント整備
- [ ] 統合テスト

#### 成果物:

- 完全統合システム
- 運用ドキュメント
- テストスイート

---

## 🛠️ 技術仕様

### 共通基盤

```typescript
// deno.json
{
  "imports": {
    "discord.js": "npm:discord.js@^14",
    "@slack/bolt": "npm:@slack/bolt@^3",
    "dotenv": "https://deno.land/std@0.208.0/dotenv/mod.ts"
  },
  "tasks": {
    "start": "deno run --allow-all bot.ts",
    "dev": "deno run --allow-all --watch bot.ts"
  }
}
```

### アーキテクチャ設計

```
┌─────────────────┐    ┌─────────────────┐
│   Discord Bot   │    │   Slack Bot     │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          └──────┬─────────────────┘
                 │
         ┌───────▼───────┐
         │ Unified       │
         │ Session       │
         │ Manager       │
         └───────┬───────┘
                 │
         ┌───────▼───────┐
         │ Claude Code   │
         │ CLI Interface │
         └───────────────┘
```

### 主要コンポーネント

#### 1. セッション管理

```typescript
interface UnifiedSession {
  sessionId: string;
  platform: "discord" | "slack";
  channelId: string;
  userId: string;
  createdAt: Date;
  lastActivity: Date;
  topic: string;
}

class UnifiedSessionManager {
  private sessions = new Map<string, UnifiedSession>();

  createSession(platform: "discord" | "slack", channelId: string, userId: string): string;
  getSession(sessionId: string): UnifiedSession | undefined;
  updateActivity(sessionId: string): void;
  cleanupSessions(): void;
}
```

#### 2. Claude Code統合

```typescript
interface ClaudeCodeInterface {
  execute(prompt: string, sessionId: string, projectRoot: string): Promise<ClaudeResponse>;
}

class ClaudeCodeCLI implements ClaudeCodeInterface {
  async execute(prompt: string, sessionId: string, projectRoot: string) {
    const command = new Deno.Command("claude", {
      args: ["-p", prompt, "--session-id", sessionId, "--output-format", "json"],
      cwd: projectRoot,
      stdout: "piped",
      stderr: "piped",
    });

    // 実行と結果解析
  }
}
```

#### 3. プラットフォーム統合

```typescript
abstract class BaseBotHandler {
  protected sessionManager: UnifiedSessionManager;
  protected claudeInterface: ClaudeCodeInterface;

  abstract initialize(): Promise<void>;
  abstract handleMessage(message: any): Promise<void>;

  protected async processPrompt(
    platform: string,
    channelId: string,
    userId: string,
    prompt: string,
  ): Promise<void> {
    const sessionId = this.sessionManager.createSession(platform as any, channelId, userId);
    const result = await this.claudeInterface.execute(prompt, sessionId, Deno.cwd());
    // 応答処理
  }
}

class DiscordBotHandler extends BaseBotHandler {
  // Discord固有の実装
}

class SlackBotHandler extends BaseBotHandler {
  // Slack固有の実装
}
```

---

## 🔐 セキュリティ考慮事項

### 環境変数管理

```bash
# .env
DISCORD_BOT_TOKEN=your_discord_bot_token
SLACK_BOT_TOKEN=your_slack_bot_token
SLACK_SIGNING_SECRET=your_slack_signing_secret
AUTHORIZED_DISCORD_USER_ID=your_discord_user_id
AUTHORIZED_SLACK_USER_ID=your_slack_user_id
GUILD_ID=your_discord_server_id
SLACK_CHANNEL_ID=your_slack_channel_id
```

### セキュリティ対策

1. **トークン管理**
   - 環境変数での管理
   - .gitignoreに追加
   - 定期的なトークンローテーション

2. **アクセス制御**
   - 特定ユーザーのみ許可
   - 特定チャンネル/サーバーのみ
   - コマンド実行権限の制限

3. **プロジェクト範囲制限**
   - 起動ディレクトリ配下のみアクセス
   - 親ディレクトリアクセス禁止
   - システムディレクトリ保護

---

## 📋 実装チェックリスト

### Phase 1: Discord Bot

- [ ] Deno + TypeScript環境構築
- [ ] Discord.js v14インストール・設定
- [ ] Bot認証・接続確認
- [ ] メンション検知機能
- [ ] スレッド作成・管理
- [ ] Claude Code CLI統合
- [ ] セッション管理実装
- [ ] エラーハンドリング
- [ ] 基本動作テスト

### Phase 2: Slack Bot

- [ ] @slack/bolt統合
- [ ] Slack App設定完了
- [ ] Events API対応
- [ ] app_mention検知
- [ ] 統一セッション管理拡張
- [ ] プラットフォーム抽象化
- [ ] Slack固有機能実装
- [ ] 相互運用テスト

### Phase 3: 統合・最適化

- [ ] 設定ファイル統一
- [ ] ログシステム実装
- [ ] パフォーマンス測定・改善
- [ ] エラー監視システム
- [ ] ドキュメント作成
- [ ] デプロイメント手順
- [ ] 統合テスト完了

---

## 🎯 期待される効果

### 開発効率向上

- **マルチプラットフォーム対応**: Discord/Slack両方から同一機能アクセス
- **シームレス統合**: プラットフォーム間でのセッション共有
- **統一体験**: どちらのプラットフォームでも同じ操作感

### 運用メリット

- **柔軟性**: 状況に応じたプラットフォーム選択
- **可用性**: 一方のプラットフォームに問題があっても継続利用可能
- **拡張性**: 将来的な他プラットフォーム対応の基盤

---

## 🚀 開始手順

### 1. 環境準備

```bash
# Deno インストール（まだの場合）
curl -fsSL https://deno.land/install.sh | sh

# Claude Code CLI インストール
npm install -g @anthropic-ai/claude-code

# プロジェクト作成
mkdir claude-multiplatform-bot
cd claude-multiplatform-bot
```

### 2. Discord Bot設定

1. Discord Developer Portal でアプリケーション作成
2. Bot追加・権限設定
3. サーバーに招待
4. トークン取得・保存

### 3. Slack Bot設定（Phase 2）

1. Slack API でアプリ作成
2. OAuth & Permissions設定
3. Event Subscriptions設定
4. ワークスペースにインストール

### 4. 開発開始

```bash
# Phase 1: Discord Bot実装
deno run --allow-all discord-bot.ts

# Phase 2: Slack統合
deno run --allow-all unified-bot.ts
```

---

この計画書に従って段階的に開発を進めることで、確実で安定したマルチプラットフォームボットシステムが構築できます。

**推定総開発時間: 4-6日**
**推定総複雑度: ⭐⭐⭐☆☆ (中)**
