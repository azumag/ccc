# Claude Discord Bot

🤖 Discord channels integrated with Claude Code - Send messages to Discord and get Claude-powered responses through a persistent tmux session.

[![GitHub](https://img.shields.io/github/stars/azumag/ccc?style=social)](https://github.com/azumag/ccc)
[![Deno](https://img.shields.io/badge/deno-2.0+-green)](https://deno.land/)

## ✨ Features

- 🎯 **Simple Design**: Direct message forwarding from Discord to Claude Code
- ⚡ **Fast Execution**: No mentions required, processes messages automatically
- 🔄 **Persistent Sessions**: Maintains Claude sessions via tmux
- 🧠 **Enhanced Modes**: Orchestrator, ultrathink, auto-commit/push
- 📊 **Progress Tracking**: Real-time progress updates for long tasks
- 🛡️ **Flexible Permissions**: Optional permission skipping

## 🚀 Quick Start

```bash
# 1. Install from GitHub
deno install --global --allow-read --allow-write=/tmp,.ccc.env,.ccc.env.example --allow-net=discord.com,gateway.discord.gg --allow-env --allow-run=tmux,claude,git --allow-sys -n claude-discord-bot https://raw.githubusercontent.com/azumag/ccc/main/cli-standalone.ts

# 2. Initialize in your project
cd your-project
claude-discord-bot init

# 3. Start the bot
claude-discord-bot start
```

## 📦 Installation Methods

### Method 1: GitHub Direct (Recommended)

```bash
deno install --global --allow-read --allow-write=/tmp,.ccc.env,.ccc.env.example --allow-net=discord.com,gateway.discord.gg --allow-env --allow-run=tmux,claude,git --allow-sys -n claude-discord-bot https://raw.githubusercontent.com/azumag/ccc/main/cli-standalone.ts
```

### Method 2: Development/Customization

```bash
git clone https://github.com/azumag/ccc.git
cd ccc
deno install --global --allow-read --allow-write=/tmp,.ccc.env,.ccc.env.example --allow-net=discord.com,gateway.discord.gg --allow-env --allow-run=tmux,claude,git --allow-sys -n claude-discord-bot ./cli.ts
```

### Method 3: One-time Use

```bash
deno run --allow-read --allow-write=/tmp,.ccc.env,.ccc.env.example --allow-net=discord.com,gateway.discord.gg --allow-env --allow-run=tmux,claude,git --allow-sys https://raw.githubusercontent.com/azumag/ccc/main/cli-standalone.ts init
deno run --allow-read --allow-write=/tmp,.ccc.env,.ccc.env.example --allow-net=discord.com,gateway.discord.gg --allow-env --allow-run=tmux,claude,git --allow-sys https://raw.githubusercontent.com/azumag/ccc/main/cli-standalone.ts start
```

## 🔧 Prerequisites

- [Deno](https://deno.land/) 2.0+
- [tmux](https://github.com/tmux/tmux)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (authenticated)
- Discord Bot Token

## ⚙️ Configuration

### 1. Discord Bot Setup

1. Create bot at [Discord Developer Portal](https://discord.com/developers/applications)
2. Get bot token
3. Enable **Message Content Intent**
4. Add bot to server with permissions: Send Messages, Read Message History, View Channels

### 2. Environment Variables

Initialize creates `.ccc.env` file (separate from your project's `.env`):

```bash
claude-discord-bot init  # Interactive setup
```

Required variables:

```bash
DISCORD_BOT_TOKEN=your_discord_bot_token
GUILD_ID=your_discord_server_id
DISCORD_CHANNEL_NAME=claude               # Channel to monitor
TMUX_SESSION_NAME=claude-main             # tmux session name
LOG_LEVEL=info                           # debug, info, warn, error
AUTHORIZED_USER_ID=your_user_id          # Optional: restrict to specific user
```

### 3. Migration from .env

If you have existing `.env` file:

```bash
cp .env .ccc.env  # Copy existing environment
```

## 🎮 Usage

### Basic Commands

```bash
# Start bot
claude-discord-bot start

# Start with specific channel
claude-discord-bot start --channel dev-claude

# Enhanced modes
claude-discord-bot start --ultrathink     # Detailed thinking mode
claude-discord-bot start --orch           # Orchestrator mode
claude-discord-bot start --auto-commit    # Auto-commit changes

# Progress tracking
claude-discord-bot start --progress-update --progress-interval 30s

# Status and control
claude-discord-bot status
claude-discord-bot send-to-discord "Hello from CLI"
```

### Complete CLI Reference

#### Commands

- `init` - Initialize bot in project
- `start` - Start the bot
- `status` - Show bot status
- `stop` - Stop the bot
- `update` - Update CLI tool
- `send-to-discord <message>` - Send message to Discord

#### Global Options

- `-h, --help` - Show help
- `-v, --version` - Show version

#### `init` Options

- `--global` - Use global directory (~/.claude-discord-bot)
- `-p, --project <path>` - Project path (default: current directory)

#### `start` Options

**Basic Configuration:**

- `-c, --channel <name>` - Discord channel name (default: "claude")
- `-p, --project <path>` - Project path
- `--global` - Use global directory
- `--log-level <level>` - Log level: debug, info, warn, error

**Claude Integration:**

- `--ultrathink` - Enable ultrathink mode (adds "ultrathink" to prompts)
- `--dangerously-permit` - Use --dangerously-skip-permissions for Claude
- `--resume` - Start Claude with resume mode (-r flag)
- `--continue` - Start Claude with continue mode (-c flag)
- `-o, --orch` - Enable orchestrator mode (/project:orchestrator)

**Automation:**

- `--auto-commit` - Auto-commit changes when task completes
- `--auto-push` - Auto-push commits when task completes
- `--progress-update` - Send progress updates to Discord
- `--progress-interval <time>` - Update interval (default: "1m", e.g. "30s", "2m")

#### `send-to-discord` Options

- `--session <name>` - Tmux session name (default: from env or "claude-main")

## 🐳 Docker Support

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t claude-discord-bot .
docker run -d --name claude-bot \
  -v $(pwd):/workspace \
  --env-file .ccc.env \
  claude-discord-bot
```

## 🔍 Troubleshooting

### Common Issues

**Bot not responding:**

```bash
# Check tmux session
tmux list-sessions
tmux attach -t claude-main

# Check bot status
claude-discord-bot status
```

**Permission errors:**

- Verify Discord bot permissions (Send Messages, Message Content Intent)
- Check `AUTHORIZED_USER_ID` if set

**Environment issues:**

```bash
# Verify .ccc.env file exists and has required variables
cat .ccc.env
```

## 💻 Development

```bash
git clone https://github.com/azumag/ccc.git
cd ccc

# Install dependencies
deno install

# Run tests
deno test

# Format and lint
deno fmt
deno lint

# Build
deno compile --allow-read --allow-write=/tmp,.ccc.env,.ccc.env.example --allow-net=discord.com,gateway.discord.gg --allow-env --allow-run=tmux,claude,git --allow-sys --output ./bin/claude-discord-bot cli.ts
```

## 📚 Programmatic Usage

```typescript
import { ClaudeDiscordBot } from "https://raw.githubusercontent.com/azumag/ccc/main/mod.ts";

const bot = new ClaudeDiscordBot({
  discordToken: "your-token",
  guildId: "your-guild-id",
  channelName: "claude",
  tmuxSessionName: "claude-main",
  logLevel: "info",
});

await bot.start();
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions welcome! Please read the contributing guidelines and submit pull requests.
