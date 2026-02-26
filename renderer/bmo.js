/* ═══════════════════════════════════════════════════
   JoeMac Avatar — BMO Animation Engine v2
   Now with: squinty eyes, screen moods, sparkles,
   click reactions, sitting, and more personality
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
const screenBg     = document.getElementById('screen-bg');
const sparklesDiv  = document.getElementById('sparkles');
const bmoShadow    = document.getElementById('bmo-shadow');

// Happy eye arcs
const leftEyeHappy  = document.getElementById('left-eye-happy');
const rightEyeHappy = document.getElementById('right-eye-happy');
const leftEyeDot    = leftEye.querySelector('circle');
const rightEyeDot   = rightEye.querySelector('circle');

// ─── Mouth Shapes (SVG path data) ────────────────
const MOUTH_SHAPES = {
  closed:  'M 185 195 Q 200 210 215 195',
  open:    'M 180 192 Q 200 215 220 192 Z',
  o:       'M 192 190 Q 200 205 208 190 Q 215 182 208 178 Q 200 174 192 178 Q 185 182 192 190',
  wide:    'M 175 190 Q 200 220 225 190 Z',
  smile:   'M 180 195 Q 200 215 220 195',
  happy:   'M 178 192 Q 200 218 222 192 Q 200 222 178 192',  // open grin
  grin:    'M 178 190 Q 200 215 222 190 L 222 195 Q 200 188 178 195 Z',  // grin with teeth
  think:   'M 188 198 L 212 198',
  sad:     'M 185 205 Q 200 195 215 205',
  surprise:'M 190 190 Q 200 210 210 190 Q 215 185 210 180 Q 200 175 190 180 Q 185 185 190 190',
};

// ─── Screen Colors ────────────────────────────────
const SCREEN_COLORS = {
  idle:     '#D1F2DC',  // default mint green
  happy:    '#C8F7C5',  // brighter green
  thinking: '#C5D8F7',  // soft blue
  excited:  '#F7D5E0',  // soft pink
  sad:      '#D0D5E0',  // muted grey-blue
  sleep:    '#B8C8D0',  // dim grey
};

// ─── State ────────────────────────────────────────
let currentState       = 'idle';
let blinkTimeout       = null;
let mouthCycleInterval = null;
let isAnimating        = false;
let lastTimestamp      = 0;
let lastActivityTime   = Date.now();
let isSleeping         = false;
let isSitting          = false;
let sleepCheckInterval = null;
let sitTimeout         = null;
const SLEEP_AFTER_MS   = 5 * 60 * 1000;

// ─── Utility ──────────────────────────────────────
function setState(state) {
  bmoWrapper.classList.remove('idle', 'thinking', 'speaking', 'happy', 'wave', 'sitting');
  if (state !== 'idle') bmoWrapper.classList.add(state);
  currentState = state;
}

function setMouth(shape) {
  if (MOUTH_SHAPES[shape]) {
    const isFilled = ['open', 'wide', 'happy', 'grin', 'o', 'surprise'].includes(shape);
    const showTeeth = ['open', 'wide', 'happy', 'grin'].includes(shape);
    
    mouthPath.setAttribute('d', MOUTH_SHAPES[shape]);
    mouthPath.setAttribute('fill', isFilled ? '#1D5C4A' : 'none');
    
    // Show/hide teeth and tongue for open mouth states
    const teeth = document.getElementById('mouth-teeth');
    const tongue = document.getElementById('mouth-tongue');
    if (teeth) teeth.style.display = showTeeth ? '' : 'none';
    if (tongue) tongue.style.display = isFilled ? '' : 'none';
  }
}

function setScreenColor(mood) {
  if (screenBg && SCREEN_COLORS[mood]) {
    screenBg.setAttribute('fill', SCREEN_COLORS[mood]);
  }
}

// ─── Squinty Happy Eyes ──────────────────────────
function setHappyEyes(on) {
  if (!leftEyeHappy || !rightEyeHappy) return;
  if (on) {
    leftEyeDot.style.display = 'none';
    rightEyeDot.style.display = 'none';
    leftEyeHappy.style.display = '';
    rightEyeHappy.style.display = '';
  } else {
    leftEyeDot.style.display = '';
    rightEyeDot.style.display = '';
    leftEyeHappy.style.display = 'none';
    rightEyeHappy.style.display = 'none';
  }
}

// ─── Sparkles ────────────────────────────────────
function spawnSparkles(count = 6) {
  if (!sparklesDiv) return;
  const emojis = ['✨', '⭐', '🌟', '💫', '★'];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'sparkle';
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.left = (30 + Math.random() * 60) + '%';
    el.style.top = (20 + Math.random() * 40) + '%';
    el.style.animationDelay = (Math.random() * 0.5) + 's';
    el.style.fontSize = (12 + Math.random() * 12) + 'px';
    sparklesDiv.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }
}

// ─── Blink System ────────────────────────────────
function scheduleBlink() {
  clearTimeout(blinkTimeout);
  const delay = 3000 + Math.random() * 5000;
  blinkTimeout = setTimeout(doBlink, delay);
}

function doBlink() {
  if (currentState === 'thinking' || isSleeping) {
    scheduleBlink();
    return;
  }

  const leftCircle = leftEyeDot;
  const rightCircle = rightEyeDot;
  if (!leftCircle || !rightCircle || leftCircle.style.display === 'none') { scheduleBlink(); return; }

  const lcy = leftCircle.getAttribute('cy');
  const rcy = rightCircle.getAttribute('cy');

  leftCircle.style.transformOrigin = `center ${lcy}px`;
  rightCircle.style.transformOrigin = `center ${rcy}px`;
  leftCircle.style.transition = 'transform 0.08s ease-in-out';
  rightCircle.style.transition = 'transform 0.08s ease-in-out';
  leftCircle.style.transform = 'scaleY(0.05)';
  rightCircle.style.transform = 'scaleY(0.05)';

  setTimeout(() => {
    leftCircle.style.transform = '';
    rightCircle.style.transform = '';
    setTimeout(() => {
      leftCircle.style.transition = '';
      rightCircle.style.transition = '';
    }, 100);
  }, 120);

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
  }, 160);
}

function stopMouthCycle() {
  clearInterval(mouthCycleInterval);
  mouthCycleInterval = null;
  setMouth('closed');
}

// ─── Sitting ─────────────────────────────────────
function sitDown() {
  if (isSitting || isSleeping || isAnimating) return;
  isSitting = true;
  
  bmoWrapper.classList.add('sitting');
  
  const leftLeg = document.getElementById('left-leg');
  const rightLeg = document.getElementById('right-leg');
  const leftFoot = document.getElementById('left-foot');
  const rightFoot = document.getElementById('right-foot');
  
  // Splay legs outward — feet point outward like sitting BMO
  if (leftLeg) leftLeg.setAttribute('d', 'M 150 375 C 140 390 110 400 90 410');
  if (rightLeg) rightLeg.setAttribute('d', 'M 250 375 C 260 390 290 400 310 410');
  // Feet become horizontal, pointing outward (L-shaped)
  if (leftFoot) { leftFoot.setAttribute('cx', '78'); leftFoot.setAttribute('cy', '412'); leftFoot.setAttribute('rx', '16'); leftFoot.setAttribute('ry', '6'); }
  if (rightFoot) { rightFoot.setAttribute('cx', '322'); rightFoot.setAttribute('cy', '412'); rightFoot.setAttribute('rx', '16'); rightFoot.setAttribute('ry', '6'); }
  
  if (bmoShadow) { bmoShadow.style.width = '160px'; }
  
  setMouth('smile');
  console.log('🪑 BMO sat down');
  setTimeout(() => { if (isSitting && !isAnimating) setMouth('closed'); }, 1500);
}

function standUp() {
  if (!isSitting) return;
  isSitting = false;
  
  bmoWrapper.classList.remove('sitting');
  
  const leftLeg = document.getElementById('left-leg');
  const rightLeg = document.getElementById('right-leg');
  const leftFoot = document.getElementById('left-foot');
  const rightFoot = document.getElementById('right-foot');
  
  if (leftLeg) leftLeg.setAttribute('d', 'M 150 375 L 150 440');
  if (rightLeg) rightLeg.setAttribute('d', 'M 250 375 L 250 440');
  if (leftFoot) { leftFoot.setAttribute('cx', '140'); leftFoot.setAttribute('cy', '442'); leftFoot.setAttribute('rx', '14'); leftFoot.setAttribute('ry', '7'); }
  if (rightFoot) { rightFoot.setAttribute('cx', '260'); rightFoot.setAttribute('cy', '442'); rightFoot.setAttribute('rx', '14'); rightFoot.setAttribute('ry', '7'); }
  
  if (bmoShadow) { bmoShadow.style.width = '100px'; }
  console.log('🧍 BMO stood up');
}

function scheduleSitToggle() {
  clearTimeout(sitTimeout);
  const delay = 20000 + Math.random() * 40000; // 20-60 seconds
  sitTimeout = setTimeout(() => {
    if (isAnimating || isSleeping) { scheduleSitToggle(); return; }
    if (isSitting) {
      standUp();
    } else {
      sitDown();
    }
    scheduleSitToggle();
  }, delay);
}

// ─── Sleep System ────────────────────────────────
function goToSleep() {
  if (isSleeping) return;
  isSleeping = true;
  clearTimeout(fidgetTimeout);
  clearTimeout(blinkTimeout);
  clearTimeout(sitTimeout);
  
  if (isSitting) standUp();
  setState('idle');
  setScreenColor('sleep');
  
  // Sleepy eyes
  if (leftEyeDot) leftEyeDot.style.transform = 'scaleY(0.15)';
  if (rightEyeDot) rightEyeDot.style.transform = 'scaleY(0.15)';
  setHappyEyes(false);
  
  setMouth('think');
  bmoWrapper.style.animation = 'bmo-sleep 6s ease-in-out infinite';
  startZzz();
  console.log('😴 BMO fell asleep');
}

function wakeUp() {
  if (!isSleeping) return;
  isSleeping = false;
  
  if (leftEyeDot) leftEyeDot.style.transform = '';
  if (rightEyeDot) rightEyeDot.style.transform = '';
  
  bmoWrapper.style.animation = '';
  setMouth('surprise');
  setScreenColor('excited');
  stopZzz();
  
  setTimeout(() => {
    setMouth('smile');
    setScreenColor('happy');
    setTimeout(() => {
      setMouth('closed');
      setScreenColor('idle');
      bmoWrapper.style.animation = 'bmo-float 4s ease-in-out infinite';
      scheduleBlink();
      scheduleIdleFidget();
      scheduleSitToggle();
    }, 600);
  }, 400);
  
  console.log('☀️ BMO woke up!');
}

function resetActivityTimer() {
  lastActivityTime = Date.now();
  if (isSleeping) wakeUp();
}

// Zzz floating text
let zzzInterval = null;
function startZzz() {
  stopZzz();
  let zCount = 1;
  zzzInterval = setInterval(() => {
    speechBubble.textContent = 'z'.repeat(zCount);
    speechBubble.classList.add('visible');
    zCount = (zCount % 3) + 1;
  }, 2000);
}

function stopZzz() {
  clearInterval(zzzInterval);
  zzzInterval = null;
  hideBubble();
}

function startSleepCheck() {
  clearInterval(sleepCheckInterval);
  sleepCheckInterval = setInterval(() => {
    if (!isSleeping && !isAnimating && (Date.now() - lastActivityTime > SLEEP_AFTER_MS)) {
      goToSleep();
    }
  }, 10000);
}

// ─── Idle Fidgets ────────────────────────────────
let fidgetTimeout = null;

const IDLE_FIDGETS = [
  // Look left
  () => {
    [leftEyeDot, rightEyeDot].forEach(e => {
      if (!e || e.style.display === 'none') return;
      e.style.transition = 'transform 0.4s'; e.style.transform = 'translateX(-4px)';
    });
    setTimeout(() => {
      [leftEyeDot, rightEyeDot].forEach(e => {
        if (!e) return;
        e.style.transform = ''; setTimeout(() => { e.style.transition = ''; }, 400);
      });
    }, 800);
  },
  // Look right
  () => {
    [leftEyeDot, rightEyeDot].forEach(e => {
      if (!e || e.style.display === 'none') return;
      e.style.transition = 'transform 0.4s'; e.style.transform = 'translateX(4px)';
    });
    setTimeout(() => {
      [leftEyeDot, rightEyeDot].forEach(e => {
        if (!e) return;
        e.style.transform = ''; setTimeout(() => { e.style.transition = ''; }, 400);
      });
    }, 800);
  },
  // Look up
  () => {
    [leftEyeDot, rightEyeDot].forEach(e => {
      if (!e || e.style.display === 'none') return;
      e.style.transition = 'transform 0.4s'; e.style.transform = 'translateY(-3px)';
    });
    setTimeout(() => {
      [leftEyeDot, rightEyeDot].forEach(e => {
        if (!e) return;
        e.style.transform = ''; setTimeout(() => { e.style.transition = ''; }, 400);
      });
    }, 1000);
  },
  // Quick smile with squinty eyes
  () => {
    setMouth('smile');
    setHappyEyes(true);
    setScreenColor('happy');
    setTimeout(() => {
      if (currentState === 'idle') {
        setMouth('closed');
        setHappyEyes(false);
        setScreenColor('idle');
      }
    }, 2000);
  },
  // Tiny head tilt
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
  () => { doBlink(); setTimeout(doBlink, 250); },
  // Surprised "O" mouth
  () => {
    setMouth('surprise');
    setScreenColor('excited');
    setTimeout(() => {
      if (currentState === 'idle') {
        setMouth('closed');
        setScreenColor('idle');
      }
    }, 800);
  },
  // Big grin with teeth
  () => {
    setMouth('grin');
    setHappyEyes(true);
    setTimeout(() => {
      if (currentState === 'idle') {
        setMouth('closed');
        setHappyEyes(false);
      }
    }, 1800);
  },
];

function scheduleIdleFidget() {
  clearTimeout(fidgetTimeout);
  const delay = 4000 + Math.random() * 8000;
  fidgetTimeout = setTimeout(() => {
    if (currentState !== 'idle' || isAnimating || isSleeping) {
      scheduleIdleFidget();
      return;
    }
    const fidget = IDLE_FIDGETS[Math.floor(Math.random() * IDLE_FIDGETS.length)];
    fidget();
    scheduleIdleFidget();
  }, delay);
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
  setScreenColor('thinking');
  leftArm.classList.add('thinking');

  setTimeout(() => {
    leftArm.classList.remove('thinking');
    if (doneCallback) doneCallback();
  }, 500);
}

function doSpeak(text, emotion, doneCallback) {
  const duration = Math.max(1500, text.length * 50);
  setState('speaking');
  setScreenColor('idle');
  showBubble(text);
  startMouthCycle();

  if (isSitting) standUp();

  setTimeout(() => {
    stopMouthCycle();

    if (emotion === 'happy') {
      doHappy(() => { returnToIdle(doneCallback); });
    } else {
      hideBubble();
      returnToIdle(doneCallback);
    }
  }, duration);
}

function doHappy(doneCallback) {
  setState('happy');
  setMouth('happy');
  setHappyEyes(true);
  setScreenColor('happy');
  spawnSparkles(8);

  const animDuration = 1300;
  setTimeout(() => {
    hideBubble();
    setHappyEyes(false);
    if (doneCallback) doneCallback();
  }, animDuration);
}

function returnToIdle(callback) {
  setState('idle');
  setMouth('closed');
  setHappyEyes(false);
  setScreenColor('idle');
  scheduleIdleFidget();
  scheduleSitToggle();
  if (callback) callback();
}

// ─── Full Message Sequence ────────────────────────
function handleMessage(msg) {
  if (!msg || !msg.text) return;

  if (msg.timestamp && msg.timestamp === lastTimestamp) return;
  lastTimestamp = msg.timestamp || Date.now();

  resetActivityTimer();
  if (isSitting) standUp();

  if (isAnimating) return;
  isAnimating = true;

  const text    = msg.text    || '';
  const emotion = msg.emotion || 'idle';

  doThink(() => {
    doSpeak(text, emotion, () => {
      isAnimating = false;
    });
  });
}

// ─── Click Reactions ─────────────────────────────
const CLICK_REACTIONS = [
  () => { setMouth('happy'); setHappyEyes(true); spawnSparkles(4); setTimeout(() => { setMouth('closed'); setHappyEyes(false); }, 1500); },
  () => { setMouth('surprise'); setScreenColor('excited'); setTimeout(() => { setMouth('closed'); setScreenColor('idle'); }, 800); },
  () => { doWave(); },
  () => { setMouth('grin'); setHappyEyes(true); spawnSparkles(6); setTimeout(() => { setMouth('closed'); setHappyEyes(false); }, 2000); },
  () => { 
    bmoWrapper.classList.add('clicked');
    setTimeout(() => bmoWrapper.classList.remove('clicked'), 150);
    setMouth('o');
    setTimeout(() => setMouth('closed'), 600);
  },
  () => {
    // Spin!
    bmoWrapper.style.transition = 'transform 0.5s ease-in-out';
    bmoWrapper.style.transform = 'rotate(360deg)';
    setTimeout(() => { bmoWrapper.style.transform = ''; bmoWrapper.style.transition = ''; }, 600);
  },
];

bmoWrapper.addEventListener('click', (e) => {
  if (isAnimating || isSleeping) {
    if (isSleeping) resetActivityTimer();
    return;
  }
  e.stopPropagation();
  resetActivityTimer();
  const reaction = CLICK_REACTIONS[Math.floor(Math.random() * CLICK_REACTIONS.length)];
  reaction();
});

// ─── Startup Sequence ────────────────────────────
function startup() {
  setState('idle');
  setMouth('closed');
  setScreenColor('idle');
  scheduleBlink();
  scheduleIdleFidget();
  startSleepCheck();
  scheduleSitToggle();

  setTimeout(() => doWave(), 2000);

  setTimeout(() => {
    handleMessage({
      text: "Hey! I'm JoeMac 👋",
      emotion: 'happy',
      timestamp: Date.now()
    });
  }, 4000);
}

// ─── Message Listener ────────────────────────────
if (window.joemac && window.joemac.onMessage) {
  window.joemac.onMessage((msg) => handleMessage(msg));
}

// ─── Mutation Observer for happy state ───────────
const mutationObs = new MutationObserver((mutations) => {
  mutations.forEach(m => {
    if (m.type === 'attributes' && m.attributeName === 'class') {
      const classes = bmoWrapper.className;
      if (classes.includes('happy') && !classes.includes('speaking')) {
        setMouth('happy');
      }
    }
  });
});
mutationObs.observe(bmoWrapper, { attributes: true });

// ─── Boot ─────────────────────────────────────────
startup();

// ─── Debug ────────────────────────────────────────
window._bmo = {
  wave:     () => doWave(),
  think:    () => doThink(() => returnToIdle()),
  speak:    (text, emotion) => { isAnimating = false; handleMessage({ text: text || 'Hello!', emotion: emotion || 'idle', timestamp: Date.now() }); },
  happy:    () => doHappy(() => returnToIdle()),
  message:  (text, emotion) => { isAnimating = false; handleMessage({ text, emotion, timestamp: Date.now() }); },
  sit:      () => isSitting ? standUp() : sitDown(),
  sleep:    () => isSleeping ? wakeUp() : goToSleep(),
  sparkle:  () => spawnSparkles(10),
  screen:   (mood) => setScreenColor(mood),
  state:    () => ({ state: currentState, sitting: isSitting, sleeping: isSleeping }),
};
