#!/bin/bash
# ─────────────────────────────────────────────────────
# test-message.sh
# Send a test message to the JoeMac Avatar
# Usage:
#   ./test-message.sh                    # default happy greeting
#   ./test-message.sh "Hello world" happy
#   ./test-message.sh "Hmm, let me think..." idle
# ─────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MESSAGES_FILE="$SCRIPT_DIR/messages.json"

TEXT="${1:-Hey! I'm JoeMac 👋}"
EMOTION="${2:-happy}"
TIMESTAMP=$(date +%s%3N)  # milliseconds

cat > "$MESSAGES_FILE" <<EOF
{
  "text": "$TEXT",
  "emotion": "$EMOTION",
  "timestamp": $TIMESTAMP
}
EOF

echo "✅ Message sent: \"$TEXT\" (emotion: $EMOTION)"
echo "📄 Written to: $MESSAGES_FILE"
