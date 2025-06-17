# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Discord bot CLI tool that bridges Discord channels with Claude Code, allowing users to interact with Claude directly through Discord messages. The project is built with Deno and TypeScript.

### Core Architecture

- **CLI Entry Points**: `cli.ts` (with import maps) and `cli-standalone.ts` (with full URLs)
- **Bot Core**: `src/bot.ts` - Main Discord bot implementation with message buffering
- **Claude Integration**: `src/claude.ts` - Handles Claude Code execution via tmux
- **Tmux Management**: `src/tmux.ts` - Session management and command execution
- **Message Handling**: Messages are buffered for 2 minutes or until 10 messages accumulate, then sent as batch to Claude

### Development Commands

```bash
# Type checking and linting
npm run check          # Deno type checking
npm run lint           # Deno linting
npm run fmt            # Code formatting
npm test              # Run tests

# Building and installation
npm run build         # Compile to executable
npm run install-global # Install globally

# Development workflow after changes
npm run build && /Users/azumag/.deno/bin/deno install --global --allow-all --config deno.json -f -n claude-discord-bot cli.ts
```

## 🔨 最重要ルール - 新しいルールの追加プロセス

ユーザーから今回限りではなく常に対応が必要だと思われる指示を受けた場合：

1. 「これを標準のルールにしますか？」と質問する
2. YESの回答を得た場合、CLAUDE.mdに追加ルールとして記載する
3. 以降は標準ルールとして常に適用する

このプロセスにより、プロジェクトのルールを継続的に改善していきます

## QA Process

タスク終了後、かならず単体テストと静的解析を実行し、fixを行う

## バージョン管理

CLIツールの修正・機能追加時は必ずバージョンを更新する：

1. **マイナー更新**（機能追加・修正）: `1.1.0` → `1.2.0`
2. **パッチ更新**（バグ修正のみ）: `1.1.0` → `1.1.1`
3. **メジャー更新**（破壊的変更）: `1.1.0` → `2.0.0`

### 更新対象ファイル

- `package.json`の`version`
- `cli.ts`の`VERSION`定数
- `deno.json`の`version`
- `cli-standalone.ts`の`VERSION`定数
- `jsr.json`の`version`

### 更新後の手順

```bash
# ビルド・インストール
/Users/azumag/.deno/bin/deno compile --allow-all --output ./bin/claude-discord-bot cli.ts
/Users/azumag/.deno/bin/deno install --global --allow-all --config deno.json -f -n claude-discord-bot cli.ts

# 必須：即座にcommit and push
git add .
git commit -m "feat: Update version to X.Y.Z

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin main
```

## CLI ファイル同期管理

`cli.ts`と`cli-standalone.ts`は常に機能的に同期されている必要がある：

### 修正時の必須チェック

- `cli.ts`を修正した場合、必ず`cli-standalone.ts`も同様に修正
- バージョン番号は両方で一致させる（VERSION定数）
- 新機能追加時は両ファイルに反映
- importパスの違い以外は機能的に同一を維持

### コミット前チェック

- 両ファイルのVERSION定数が一致しているか確認
- 主要機能（init, start, send-to-discord等）が両方に存在するか確認
- クラス構造とメソッドが同sync

### テスト要件

- 両方のファイルで`--version`コマンドが同じ結果を返すこと
- GitHubからの直接インストールでも最新機能が利用できること
- ローカルインストールとリモートインストールで同じ動作をすること

### 理由

GitHubのCDNキャッシュにより、`cli-standalone.ts`が古いバージョンで提供される問題を防ぐため

## Message Buffering System

Discord messages are buffered to reduce API calls and provide better context:

- **Buffer timeout**: 2 minutes (120,000ms)
- **Max buffer size**: 10 messages
- **Per-channel buffering**: Each Discord channel maintains its own buffer
- Messages are combined with user attribution before sending to Claude
- Special commands (`/restart`, `/status`) bypass buffering for immediate execution

## Development Flow

### Issue駆動開発

問題を解決する前に、必ずGitHub Issueとして発行し、解決後にissueに紐付けたcommitおよびPRを作成する

### コミット管理

- **小さな単位**でコミットする（1つの機能追加、1つのバグ修正）
- **動作する状態**でコミットすることを心がける
- **すべてのコミット後に即座にプッシュする**

#### コミットメッセージフォーマット

```bash
git commit -m "feat: 機能の説明

- 具体的な変更点1
- 具体的な変更点2

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```