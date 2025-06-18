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

タスク終了後、かならず以下のチェックを実行し、fixを行う

### 必須実行項目

1. **Formatting**: `npm run fmt` (deno fmt) でコードスタイル統一
2. **Type Check**: `npm run check` (deno check) でTypeScript検証
3. **Linting**: `npm run lint` (deno lint) でコード品質チェック
4. **Testing**: `npm test` で単体テスト実行

### 実行順序

```bash
# 標準的なQAフロー
npm run fmt      # フォーマット修正
npm run check    # 型チェック
npm run lint     # 構文チェック  
npm test         # テスト実行
```

### CI失敗防止

- **Commit前**: 必ず上記4項目を実行
- **Format違反**: CI失敗の主要原因のため特に注意
- **一括実行**: `npm run fmt && npm run check && npm run lint && npm test`

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

## Dual CLI Architecture

The project maintains two functionally identical CLI entry points:

### `cli.ts` (Import Maps Version)

- Uses Deno import maps from `deno.json`
- Shorter import paths (`@std/cli`, `discord.js`)
- Intended for local development and local installations
- Requires `deno.json` in the working directory

### `cli-standalone.ts` (Full URLs Version)

- Uses full jsr:// and npm:// URLs for imports
- Self-contained, works without import maps
- Intended for direct GitHub installation
- Works from any directory without configuration files

### Critical Synchronization Requirements

Both files must be kept functionally identical except for import statements:

- **Identical VERSION constants**: Version mismatch breaks user experience
- **Identical BotConfig interfaces**: Prevents runtime type errors
- **Identical CLI argument parsing**: Ensures consistent behavior
- **Identical prompt generation logic**: Prevents feature discrepancies
- **Identical class structures**: Maintains API compatibility

### Installation Patterns

```bash
# Local development (uses cli.ts with import maps)
git clone repo && deno install --global ./cli.ts

# Direct GitHub installation (uses cli-standalone.ts)
deno install --global https://raw.githubusercontent.com/azumag/ccc/main/cli-standalone.ts

# JSR installation (future, uses full URLs internally)
deno install jsr:@azumag/claude-discord-bot/cli
```

## Message Buffering System

Discord messages are buffered to reduce API calls and provide better context:

- **Buffer timeout**: 2 minutes (120,000ms)
- **Max buffer size**: 10 messages
- **Per-channel buffering**: Each Discord channel maintains its own buffer
- Messages are combined with user attribution before sending to Claude
- Special commands (`/restart`, `/status`) bypass buffering for immediate execution

## Prompt Generation Architecture

The CLI uses a sophisticated prompt generation system that transforms CLI arguments into Claude prompts:

### CLI Argument Processing Flow

1. **Flag Parsing** (`cli.ts` parseArgs): CLI arguments are parsed into boolean/string options
2. **BotConfig Mapping**: Arguments are mapped to BotConfig interface properties
3. **Prompt Enhancement** (`processMessage` method): BotConfig drives prompt generation

### Key Prompt Components (Applied in Order)

```typescript
// 1. Project Mode Prefix
const projectPrefix = config.orchestratorMode ? "/project:orchestrator\n\n" : "";

// 2. Core User Message
// (unchanged user input)

// 3. Enhanced Thinking Mode
const ultrathinkText = config.enableUltraThink ? "\n\nultrathink\n" : "";

// 4. Auto-Git Instructions
if (config.autoCommit || config.autoPush) {
  // Adds post-task git commit/push commands
}

// 5. Progress Update Instructions
if (config.progressUpdate) {
  // Adds periodic progress reporting instructions with interval
}

// 6. Discord Response Command
// Always appended: instructions to use send-to-discord command
```

### Critical Implementation Details

- **Prompt order matters**: Each component is appended in specific sequence
- **CLI synchronization**: Both `cli.ts` and `cli-standalone.ts` must implement identical logic
- **Regression prevention**: Test file `tests/cli-prompt-generation.test.ts` prevents prompt generation bugs

### New Feature Integration Pattern

When adding new CLI options that affect prompts:

1. Add to `BotConfig` interface in both CLI files
2. Add to `parseArgs` string/boolean arrays
3. Add to `startCommand` argument type
4. Add to config object mapping
5. Add prompt generation logic in `processMessage`
6. Update test file with new test cases
7. Sync both CLI files identically

## Progress Update System

Latest feature addition enabling real-time task progress reporting to Discord:

### CLI Flags

- `--progress-update`: Enables progress reporting during long-running tasks
- `--progress-interval <time>`: Sets reporting interval (default: 1m, examples: 30s, 2m)

### Implementation

The system adds instructions to Claude's prompt to periodically report progress:

```typescript
progressInstructions = `
重要: 長時間タスクの場合、${interval}間隔または重要な進捗があるたびに以下のコマンドで途中経過を報告してください:
claude-discord-bot send-to-discord "進捗: [現在の作業内容と進行状況]" --session ${tmuxSessionName}

進捗報告の例:
- "進捗: ファイル解析完了、3/10ファイル処理済み"
- "進捗: テスト実行中、2/5スイート完了"
- "進捗: デプロイ中、ビルド完了・アップロード開始"
`;
```

### Usage

```bash
# Enable progress updates with default 1-minute interval
claude-discord-bot start --progress-update

# Custom 30-second interval
claude-discord-bot start --progress-update --progress-interval 30s

# Combined with other options
claude-discord-bot start --orch --progress-update --auto-commit
```

## Testing Strategy

### Prompt Generation Testing

Critical for preventing regressions in CLI argument to prompt transformation:

- **Test file**: `tests/cli-prompt-generation.test.ts`
- **Coverage**: All CLI flag combinations and prompt order verification
- **Pattern**: Mock BotConfig → Generate prompt → Assert expected content and order

### Test Categories

1. **Individual flags**: Each option tested in isolation
2. **Flag combinations**: Complex multi-option scenarios
3. **Order verification**: Ensures prompt components appear in correct sequence
4. **Edge cases**: Default values, empty configurations, special characters

### Regression Prevention Process

When modifying prompt generation:

1. Run existing tests: `npm run test:prompt`
2. Add new test cases for new functionality
3. Verify both positive and negative test cases
4. Ensure prompt order remains consistent

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
