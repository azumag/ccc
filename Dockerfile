FROM denoland/deno:2.0.5-alpine

# Install tmux and bash
RUN apk add --no-cache tmux bash curl

WORKDIR /app

# Copy dependency files first for better caching
COPY deno.json deno.lock* ./

# Cache dependencies
RUN deno cache --reload src/bot.ts

# Copy source code
COPY . .

# Install CLI tool globally
RUN deno install --global --allow-all -n claude-discord-bot ./cli.ts

# Add deno bin to PATH
ENV PATH="/root/.deno/bin:$PATH"

# Create directories for volumes
RUN mkdir -p /app/project /app/logs

# Set up proper permissions
RUN chmod +x /root/.deno/bin/claude-discord-bot

# Health check - verify CLI tool is working
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD claude-discord-bot --help > /dev/null || exit 1

# Create a startup script to handle environment setup
RUN echo '#!/bin/bash\n\
set -e\n\
echo "🚀 Starting Claude Discord Bot..."\n\
echo "📁 Working directory: $(pwd)"\n\
echo "🔧 Environment:"\n\
echo "  - Deno: $(deno --version | head -n1)"\n\
echo "  - tmux: $(tmux -V)"\n\
echo "  - PATH: $PATH"\n\
\n\
# Verify CLI tool installation\n\
if ! command -v claude-discord-bot &> /dev/null; then\n\
  echo "❌ CLI tool not found, reinstalling..."\n\
  deno install --global --allow-all -n claude-discord-bot ./cli.ts\n\
fi\n\
\n\
# Start the bot\n\
exec claude-discord-bot start\n\
' > /app/start.sh

RUN chmod +x /app/start.sh

# Default command
CMD ["/app/start.sh"]