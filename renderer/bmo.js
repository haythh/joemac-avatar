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
  closed:  'M 185 195 Q 200 210 215 195',                                       // gentle closed smile
  open:    'M 180 192 Q 200 215 220 192 Z',                                     // open mouth (dark inside)
  o:       'M 192 190 Q 200 205 208 190 Q 215 182 208 178 Q 200 174 192 178 Q 185 182 192 190', // round "O"
  wide:    'M 175 190 Q 200 220 225 190 Z',                                     // wide open BMO mouth
  smile:   'M 180 195 Q 200 215 220 195',                                       // big happy smile
  happy:   'M 178 192 Q 200 218 222 192 Q 200 222 178 192',                    // open grin with bottom curve
  think:   'M 188 198 L 212 198',                                               // flat thinking line
  sad:     'M 185 205 Q 200 195 215 205',                                       // slight frown
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
  // Restart idle fidgets
  scheduleIdleFidget();
  if (callback) callback();
}

// ─── Idle Fidgets (random micro-animations) ──────
let fidgetTimeout = null;

const IDLE_FIDGETS = [
  // Look left then back
  () => {
    [leftEye, rightEye].forEach(e => { e.style.transition = 'transform 0.4s'; e.style.transform = 'translateX(-4px)'; });
    setTimeout(() => {
      [leftEye, rightEye].forEach(e => { e.style.transform = 'translateX(0)'; });
      setTimeout(() => { [leftEye, rightEye].forEach(e => { e.style.transition = ''; }); }, 400);
    }, 800);
  },
  // Look right then back
  () => {
    [leftEye, rightEye].forEach(e => { e.style.transition = 'transform 0.4s'; e.style.transform = 'translateX(4px)'; });
    setTimeout(() => {
      [leftEye, rightEye].forEach(e => { e.style.transform = 'translateX(0)'; });
      setTimeout(() => { [leftEye, rightEye].forEach(e => { e.style.transition = ''; }); }, 400);
    }, 800);
  },
  // Look up
  () => {
    [leftEye, rightEye].forEach(e => { e.style.transition = 'transform 0.4s'; e.style.transform = 'translateY(-3px)'; });
    setTimeout(() => {
      [leftEye, rightEye].forEach(e => { e.style.transform = 'translateY(0)'; });
      setTimeout(() => { [leftEye, rightEye].forEach(e => { e.style.transition = ''; }); }, 400);
    }, 1000);
  },
  // Quick smile
  () => {
    setMouth('smile');
    setTimeout(() => { if (currentState === 'idle') setMouth('closed'); }, 1500);
  },
  // Tiny head tilt (whole wrapper)
  () => {
    bmoWrapper.style.transition = 'transform 0.6s ease-in-out';
    bmoWrapper.style.transform = 'rotate(3deg)';
    setTimeout(() => {
      bmoWrapper.style.transform = 'rotate(-2deg)';
      setTimeout(() => {
        bmoWrapper.style.transform = '';
        bmoWrapper.style.transition = '';
      }, 600);
    }, 800);
  },
  // Double blink
  () => {
    doBlink();
    setTimeout(doBlink, 250);
  },
  // "O" mouth (surprised)
  () => {
    setMouth('o');
    setTimeout(() => { if (currentState === 'idle') setMouth('closed'); }, 800);
  },
];

function scheduleIdleFidget() {
  clearTimeout(fidgetTimeout);
  const delay = 4000 + Math.random() * 8000; // 4–12 seconds
  fidgetTimeout = setTimeout(() => {
    if (currentState !== 'idle' || isAnimating) {
      scheduleIdleFidget();
      return;
    }
    const fidget = IDLE_FIDGETS[Math.floor(Math.random() * IDLE_FIDGETS.length)];
    fidget();
    scheduleIdleFidget();
  }, delay);
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
  scheduleIdleFidget();

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
