#!/bin/bash
# Send a message to BMO avatar
# Usage: send-to-bmo.sh "message text" [emotion]
# Emotions: idle, happy, thinking, sad

TEXT="${1:-Hello!}"
EMOTION="${2:-idle}"

curl -s -X POST http://127.0.0.1:7777/message \
  -H "Content-Type: application/json" \
  -d "{\"text\": $(echo "$TEXT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))'), \"emotion\": \"$EMOTION\"}" \
  > /dev/null 2>&1

if [ $? -eq 0 ]; then
  exit 0
else
  # Fallback: write directly to messages.json
  TIMESTAMP=$(date +%s)000
  echo "{\"text\": $(echo "$TEXT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))'), \"emotion\": \"$EMOTION\", \"timestamp\": $TIMESTAMP}" > "$(dirname "$0")/messages.json"
fi
