# 🎮 JoeMac Avatar

A floating BMO (Adventure Time) desktop companion built with Electron. BMO lives in the corner of your screen, animates, and displays messages in real-time.

---

## Features

- **Faithful BMO SVG character** — teal body, pixel eyes, D-pad, buttons, arms, legs
- **5 animation states**: Idle (float + blink), Speaking, Thinking, Happy, Wave
- **Real-time message system** via file watching (`messages.json`)
- **Speech bubble** with Space Grotesk font, fades in/out
- **Frameless, transparent, always-on-top** — floats above all windows
- **System tray** icon with quick actions

---

## Setup

```bash
# Install dependencies
npm install

# Generate tray icon (run once)
node generate-icon.js

# Start the app
npm start
```

---

## Send Messages

### Shell script
```bash
# Default test message
./test-message.sh

# Custom message
./test-message.sh "You're doing great!" happy

# Trigger thinking state
./test-message.sh "Hmm, processing..." idle
```

### Write directly to messages.json
```json
{
  "text": "Hello from JoeMac!",
  "emotion": "happy",
  "timestamp": 1700000000000
}
```

`timestamp` must change each time to trigger a new message (use milliseconds: `Date.now()`).

---

## Animation States

| State     | Trigger            | Description                                      |
|-----------|--------------------|--------------------------------------------------|
| `idle`    | Default            | Gentle float + blink + breathe                   |
| `thinking`| Before speaking    | Eyes look sideways, flat mouth, arm to chin      |
| `speaking`| Message received   | Mouth cycles shapes, arms gesture, screen glows  |
| `happy`   | `emotion: "happy"` | Big smile, arms raised, double bounce            |
| `wave`    | Startup            | Right arm waves 3 times                          |

---

## Project Structure

```
joemac-avatar/
├── main.js           # Electron main process — window, tray, file watcher
├── preload.js        # contextBridge API — exposes safe IPC to renderer
├── renderer/
│   ├── index.html    # BMO SVG + CSS animations
│   └── bmo.js        # Animation engine, message handler
├── messages.json     # Drop messages here to trigger BMO
├── generate-icon.js  # One-time tray icon PNG generator
├── test-message.sh   # Quick test message sender
└── package.json
```

---

## Integration with OpenClaw

JoeMac Avatar is designed to work as a companion for the OpenClaw AI assistant.  
Point your scripts or the OpenClaw agent to write to `messages.json` and BMO will animate accordingly.

Example from any script:
```bash
echo '{"text":"Your build is done! 🎉","emotion":"happy","timestamp":'$(date +%s%3N)'}' > \
  ~/.openclaw/workspace/joemac-avatar/messages.json
```

---

## Keyboard / Tray Actions

Right-click the tray icon to:
- **Show / Hide** the avatar window
- **Send Test Message** — triggers a happy greeting
- **Quit**

---

## Development

Open DevTools (uncomment in `main.js`) and use the `_bmo` debug object:

```js
_bmo.wave()            // trigger wave
_bmo.think()           // trigger thinking
_bmo.happy()           // trigger happy bounce
_bmo.speak("Hello!")   // speak a message
_bmo.message("Hi!", "happy")  // full sequence
_bmo.state()           // current animation state
```

---

## License

MIT — Built with ❤️ for JoeMac
