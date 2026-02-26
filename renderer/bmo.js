/* ═══════════════════════════════════════════════════
   JoeMac Avatar — BMO Animation Engine
   Vanilla JS, no dependencies
═══════════════════════════════════════════════════ */

// ─── Element References ───────────────────────────
const bmoWrapper   = document.getElementById('bmo-wrapper');
const speechBubble = document.getElementById('speech-bubble');
const mouthPath    = document.getElementById('mouth-path');
const leftEye      = document.getElementById('left-eye');
const rightEye     = document.getElementById('right-eye');
const leftArm      = document.getElementById('left-arm');
const rightArm     = document.getElementById('right-arm');
const screen       = document.getElementById('screen');

// ─── Mouth Shapes (SVG path data) ────────────────
const MOUTH_SHAPES = {
  closed:  'M82,98 Q100,102 118,98',                     // gentle closed smile
  open:    'M82,96 Q100,110 118,96',                     // open smile/vowel
  o:       'M91,95 Q100,108 109,95 Q118,82 109,78 Q100,72 91,78 Q82,82 91,95', // "O" shape
  wide:    'M78,94 Q100,112 122,94',                     // wide open
  smile:   'M82,95 Q100,108 118,95',                     // big smile
  think:   'M88,98 L112,98',                             // flat thinking line
  sad:     'M82,104 Q100,96 118,104',                    // slight frown
};

// ─── State ────────────────────────────────────────
let currentState       = 'idle';
let speakInterval      = null;
let blinkTimeout       = null;
let mouthCycleInterval = null;
let isAnimating        = false;
let lastTimestamp      = 0;

// ─── Utility: set state classes ───────────────────
function setState(state) {
  bmoWrapper.classList.remove('idle', 'thinking', 'speaking', 'happy', 'wave');
  if (state !== 'idle') bmoWrapper.classList.add(state);
  currentState = state;
}

function setMouth(shape) {
  if (MOUTH_SHAPES[shape]) {
    mouthPath.setAttribute('d', MOUTH_SHAPES[shape]);
  }
}

// ─── Blink System ────────────────────────────────
function scheduleBlink() {
  clearTimeout(blinkTimeout);
  const delay = 3000 + Math.random() * 5000; // 3–8 seconds
  blinkTimeout = setTimeout(doBlink, delay);
}

function doBlink() {
  if (currentState === 'thinking') {
    // Eyes look sideways instead of blinking during thinking
    scheduleBlink();
    return;
  }

  // Quick close → open by momentarily scaling the eye groups
  [leftEye, rightEye].forEach(eye => {
    eye.classList.add('blinking');
    eye.addEventListener('animationend', () => {
      eye.classList.remove('blinking');
    }, { once: true });
  });

  scheduleBlink();
}

// ─── Speech Bubble ───────────────────────────────
function showBubble(text) {
  speechBubble.textContent = text;
  speechBubble.classList.add('visible');
}

function hideBubble() {
  speechBubble.classList.remove('visible');
}

// ─── Mouth Cycling (speaking) ────────────────────
const SPEAK_SEQUENCE = ['closed', 'open', 'o', 'open', 'wide', 'closed', 'o', 'open'];
let mouthIdx = 0;

function startMouthCycle() {
  mouthIdx = 0;
  clearInterval(mouthCycleInterval);
  mouthCycleInterval = setInterval(() => {
    setMouth(SPEAK_SEQUENCE[mouthIdx % SPEAK_SEQUENCE.length]);
    mouthIdx++;
  }, 160); // ~6 fps
}

function stopMouthCycle() {
  clearInterval(mouthCycleInterval);
  mouthCycleInterval = null;
  setMouth('closed');
}

// ─── Animation Sequences ─────────────────────────

function doWave(doneCallback) {
  setState('idle');
  rightArm.classList.add('wave');
  rightArm.addEventListener('animationend', () => {
    rightArm.classList.remove('wave');
    if (doneCallback) doneCallback();
  }, { once: true });
}

function doThink(doneCallback) {
  setState('thinking');
  setMouth('think');
  leftArm.classList.add('thinking');

  setTimeout(() => {
    leftArm.classList.remove('thinking');
    if (doneCallback) doneCallback();
  }, 500);
}

function doSpeak(text, emotion, doneCallback) {
  const duration = Math.max(1500, text.length * 50);
  setState('speaking');
  showBubble(text);
  startMouthCycle();

  setTimeout(() => {
    stopMouthCycle();

    if (emotion === 'happy') {
      doHappy(() => {
        returnToIdle(doneCallback);
      });
    } else {
      hideBubble();
      returnToIdle(doneCallback);
    }
  }, duration);
}

function doHappy(doneCallback) {
  setState('happy');
  setMouth('smile');

  const animDuration = 1300; // 2 bounces × ~0.6s each + buffer
  setTimeout(() => {
    hideBubble();
    if (doneCallback) doneCallback();
  }, animDuration);
}

function returnToIdle(callback) {
  setState('idle');
  setMouth('closed');
  if (callback) callback();
}

// ─── Full Message Sequence ────────────────────────
function handleMessage(msg) {
  if (!msg || !msg.text) return;

  // Deduplicate by timestamp
  if (msg.timestamp && msg.timestamp === lastTimestamp) return;
  lastTimestamp = msg.timestamp || Date.now();

  // Don't stack animations
  if (isAnimating) return;
  isAnimating = true;

  const text    = msg.text    || '';
  const emotion = msg.emotion || 'idle';

  // Sequence: Think → Speak → (Emotion) → Idle
  doThink(() => {
    doSpeak(text, emotion, () => {
      isAnimating = false;
    });
  });
}

// ─── Startup Sequence ────────────────────────────
function startup() {
  setState('idle');
  setMouth('closed');
  scheduleBlink();

  // Wave on startup after 2s
  setTimeout(() => {
    doWave();
  }, 2000);

  // Test message after 4s
  setTimeout(() => {
    const msg = {
      text: "Hey! I'm JoeMac 👋",
      emotion: 'happy',
      timestamp: Date.now()
    };
    handleMessage(msg);
  }, 4000);
}

// ─── Message Listener (from preload/main) ────────
if (window.joemac && window.joemac.onMessage) {
  window.joemac.onMessage((msg) => {
    handleMessage(msg);
  });
}

// ─── Happy mouth override during happy state ─────
// Watch for class changes to set mouth shape
const mutationObs = new MutationObserver((mutations) => {
  mutations.forEach(m => {
    if (m.type === 'attributes' && m.attributeName === 'class') {
      const classes = bmoWrapper.className;
      if (classes.includes('happy') && !classes.includes('speaking')) {
        setMouth('smile');
      }
    }
  });
});

mutationObs.observe(bmoWrapper, { attributes: true });

// ─── Boot ─────────────────────────────────────────
startup();

// ─── Debug helpers (accessible from DevTools) ────
window._bmo = {
  wave:    () => doWave(),
  think:   () => doThink(),
  speak:   (text, emotion) => {
    doThink(() => doSpeak(text || 'Hello!', emotion || 'idle', () => {}));
  },
  happy:   () => doHappy(() => returnToIdle()),
  message: (text, emotion) => handleMessage({ text, emotion, timestamp: Date.now() }),
  state:   () => currentState
};
