/* ═══════════════════════════════════════════════════
   JoeMac Avatar — BMO Animation Engine v3
   EMOTIVE EDITION: Full personality, reactive emotions,
   expressive eyes, body language, dynamic speaking
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
const leftEyeDot    = leftEye.querySelector('ellipse') || leftEye.querySelector('circle');
const rightEyeDot   = rightEye.querySelector('ellipse') || rightEye.querySelector('circle');

// ─── Mouth Shapes (SVG path data) ────────────────
const MOUTH_SHAPES = {
  closed:  'M 185 195 Q 200 210 215 195',
  open:    'M 180 192 Q 200 215 220 192 Z',
  o:       'M 192 190 Q 200 205 208 190 Q 215 182 208 178 Q 200 174 192 178 Q 185 182 192 190',
  wide:    'M 175 190 Q 200 220 225 190 Z',
  smile:   'M 180 195 Q 200 215 220 195',
  happy:   'M 178 192 Q 200 218 222 192 Q 200 222 178 192',
  grin:    'M 178 190 Q 200 215 222 190 L 222 195 Q 200 188 178 195 Z',
  think:   'M 188 198 L 212 198',
  sad:     'M 185 205 Q 200 195 215 205',
  surprise:'M 190 190 Q 200 210 210 190 Q 215 185 210 180 Q 200 175 190 180 Q 185 185 190 190',
  smirk:   'M 183 197 Q 195 207 210 200 Q 218 195 220 192',
  worried: 'M 182 203 Q 200 193 218 203',
  tiny:    'M 193 197 Q 200 202 207 197',
  pout:    'M 190 200 Q 200 195 210 200 Q 205 206 195 206 Z',
  bigSmile:'M 175 192 Q 200 222 225 192',
};

// ─── Teeth Paths (white strip at top of open mouth) ──
const MOUTH_TEETH = {
  open:     'M 182 192 Q 200 200 218 192 L 218 196 Q 200 204 182 196 Z',
  wide:     'M 177 190 Q 200 200 223 190 L 223 195 Q 200 205 177 195 Z',
  happy:    'M 180 192 Q 200 202 220 192 L 220 197 Q 200 207 180 197 Z',
  grin:     'M 180 190 Q 200 200 220 190 L 220 195 Q 200 205 180 195 Z',
  bigSmile: 'M 177 192 Q 200 202 223 192 L 223 197 Q 200 207 177 197 Z',
};

// ─── Screen Colors ────────────────────────────────
const SCREEN_COLORS = {
  idle:     '#D1F2DC',
  happy:    '#C8F7C5',
  thinking: '#C5D8F7',
  excited:  '#F7D5E0',
  sad:      '#D0D5E0',
  sleep:    '#B8C8D0',
  love:     '#F7C5D8',
  curious:  '#E0D5F7',
  proud:    '#F7E8C5',
  scared:   '#F7E0C5',
  mischief: '#C5F7E8',
};

// ─── Emotion Profiles ─────────────────────────────
// Each emotion defines how BMO reacts during speaking
const EMOTION_PROFILES = {
  idle: {
    screenColor: 'idle',
    mouthCycleSpeed: 160,
    speakMouths: ['closed', 'open', 'o', 'open', 'wide', 'closed', 'o', 'open'],
    bodyClass: '',
    eyeStyle: null,
    armIntensity: 1,
    entryAnim: null,
  },
  happy: {
    screenColor: 'happy',
    mouthCycleSpeed: 120,
    speakMouths: ['smile', 'open', 'happy', 'open', 'wide', 'smile', 'happy', 'open'],
    bodyClass: 'emotion-happy',
    eyeStyle: 'happy',
    armIntensity: 1.6,
    entryAnim: () => {
      quickBounce(2);
      spawnSparkles(5);
    },
  },
  excited: {
    screenColor: 'excited',
    mouthCycleSpeed: 100,
    speakMouths: ['wide', 'open', 'happy', 'wide', 'o', 'wide', 'happy', 'open'],
    bodyClass: 'emotion-excited',
    eyeStyle: 'wide',
    armIntensity: 2.0,
    entryAnim: () => {
      quickBounce(3);
      spawnSparkles(10);
      wiggle(3);
    },
  },
  thinking: {
    screenColor: 'thinking',
    mouthCycleSpeed: 220,
    speakMouths: ['tiny', 'closed', 'o', 'tiny', 'closed', 'open', 'tiny', 'closed'],
    bodyClass: 'emotion-thinking',
    eyeStyle: 'lookUp',
    armIntensity: 0.4,
    entryAnim: () => {
      eyeLookDirection('up', 600);
    },
  },
  sad: {
    screenColor: 'sad',
    mouthCycleSpeed: 250,
    speakMouths: ['sad', 'tiny', 'sad', 'closed', 'worried', 'sad', 'tiny', 'sad'],
    bodyClass: 'emotion-sad',
    eyeStyle: 'droopy',
    armIntensity: 0.3,
    entryAnim: () => {
      droopBody();
    },
  },
  surprised: {
    screenColor: 'excited',
    mouthCycleSpeed: 130,
    speakMouths: ['surprise', 'o', 'wide', 'surprise', 'open', 'o', 'surprise', 'wide'],
    bodyClass: 'emotion-surprised',
    eyeStyle: 'wide',
    armIntensity: 1.8,
    entryAnim: () => {
      jumpScare();
    },
  },
  love: {
    screenColor: 'love',
    mouthCycleSpeed: 180,
    speakMouths: ['smile', 'happy', 'smile', 'open', 'happy', 'smile', 'bigSmile', 'smile'],
    bodyClass: 'emotion-love',
    eyeStyle: 'happy',
    armIntensity: 0.8,
    entryAnim: () => {
      spawnHearts(6);
      sway(2);
    },
  },
  curious: {
    screenColor: 'curious',
    mouthCycleSpeed: 170,
    speakMouths: ['o', 'tiny', 'open', 'o', 'closed', 'open', 'tiny', 'o'],
    bodyClass: 'emotion-curious',
    eyeStyle: 'lookUp',
    armIntensity: 0.7,
    entryAnim: () => {
      headTilt(8, 1200);
    },
  },
  proud: {
    screenColor: 'proud',
    mouthCycleSpeed: 150,
    speakMouths: ['smile', 'open', 'grin', 'open', 'smile', 'grin', 'open', 'smile'],
    bodyClass: 'emotion-proud',
    eyeStyle: 'happy',
    armIntensity: 1.2,
    entryAnim: () => {
      puffUp();
      spawnSparkles(4);
    },
  },
  scared: {
    screenColor: 'scared',
    mouthCycleSpeed: 100,
    speakMouths: ['surprise', 'o', 'surprise', 'worried', 'surprise', 'o', 'worried', 'surprise'],
    bodyClass: 'emotion-scared',
    eyeStyle: 'wide',
    armIntensity: 2.0,
    entryAnim: () => {
      shiver(1500);
    },
  },
  mischief: {
    screenColor: 'mischief',
    mouthCycleSpeed: 140,
    speakMouths: ['smirk', 'open', 'smirk', 'grin', 'smirk', 'open', 'grin', 'smirk'],
    bodyClass: 'emotion-mischief',
    eyeStyle: 'squint',
    armIntensity: 0.9,
    entryAnim: () => {
      headTilt(-6, 800);
      eyeNarrow();
    },
  },
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
  if (!MOUTH_SHAPES[shape]) return;
  
  const isFilled = ['open', 'wide', 'happy', 'grin', 'o', 'surprise'].includes(shape);
  const showTeeth = ['open', 'wide', 'happy', 'grin'].includes(shape);
  const pathD = MOUTH_SHAPES[shape];
  
  const mouthFill = document.getElementById('mouth-fill');
  const mouthTeeth = document.getElementById('mouth-teeth');
  
  // Outline follows shape
  mouthPath.setAttribute('d', pathD);
  
  // Fill follows same shape (dark green interior)
  if (mouthFill) {
    mouthFill.setAttribute('d', pathD);
    mouthFill.setAttribute('fill', isFilled ? '#1D5C4A' : 'none');
  }
  
  // Teeth: a thin strip at the top of the mouth opening
  if (mouthTeeth) {
    if (showTeeth) {
      // Generate teeth path that follows top edge of mouth
      mouthTeeth.setAttribute('d', MOUTH_TEETH[shape] || '');
      mouthTeeth.style.display = '';
    } else {
      mouthTeeth.style.display = 'none';
    }
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

// ─── Eye Expression System ───────────────────────
function setEyeStyle(style) {
  // Reset eyes first
  resetEyes();
  
  if (!style) return;
  
  switch (style) {
    case 'happy':
      setHappyEyes(true);
      break;
    case 'wide':
      // Big surprised eyes — scale up
      [leftEyeDot, rightEyeDot].forEach(e => {
        if (!e) return;
        e.style.transition = 'transform 0.2s ease-out';
        e.style.transform = 'scale(1.4)';
      });
      break;
    case 'lookUp':
      [leftEyeDot, rightEyeDot].forEach(e => {
        if (!e) return;
        e.style.transition = 'transform 0.3s ease';
        e.style.transform = 'translateY(-4px)';
      });
      break;
    case 'droopy':
      // Sad droopy eyes — squished and lowered
      [leftEyeDot, rightEyeDot].forEach(e => {
        if (!e) return;
        e.style.transition = 'transform 0.4s ease';
        e.style.transform = 'scaleY(0.6) translateY(2px)';
      });
      break;
    case 'squint':
      // Mischievous squint
      [leftEyeDot, rightEyeDot].forEach(e => {
        if (!e) return;
        e.style.transition = 'transform 0.3s ease';
        e.style.transform = 'scaleY(0.5) scaleX(1.2)';
      });
      break;
  }
}

function resetEyes() {
  setHappyEyes(false);
  [leftEyeDot, rightEyeDot].forEach(e => {
    if (!e) return;
    e.style.transition = 'transform 0.3s ease';
    e.style.transform = '';
    setTimeout(() => { e.style.transition = ''; }, 300);
  });
}

// ─── Eye Movement (look in direction) ────────────
function eyeLookDirection(dir, duration = 800) {
  const offsets = {
    left:  { x: -5, y: 0 },
    right: { x: 5, y: 0 },
    up:    { x: 0, y: -4 },
    down:  { x: 0, y: 3 },
  };
  const o = offsets[dir] || offsets.right;
  [leftEyeDot, rightEyeDot].forEach(e => {
    if (!e || e.style.display === 'none') return;
    e.style.transition = 'transform 0.3s ease';
    e.style.transform = `translate(${o.x}px, ${o.y}px)`;
  });
  if (duration > 0) {
    setTimeout(() => {
      [leftEyeDot, rightEyeDot].forEach(e => {
        if (!e) return;
        e.style.transform = '';
        setTimeout(() => { e.style.transition = ''; }, 300);
      });
    }, duration);
  }
}

function eyeNarrow() {
  [leftEyeDot, rightEyeDot].forEach(e => {
    if (!e) return;
    e.style.transition = 'transform 0.3s ease';
    e.style.transform = 'scaleY(0.45) scaleX(1.15)';
  });
}

// ─── Emotive Body Animations ─────────────────────
function quickBounce(times = 2) {
  const dur = 200;
  let i = 0;
  function tick() {
    if (i >= times) return;
    bmoWrapper.style.transition = `transform ${dur/2}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
    bmoWrapper.style.transform = 'translateY(-18px) scaleY(1.05)';
    setTimeout(() => {
      bmoWrapper.style.transform = 'translateY(2px) scaleY(0.96)';
      setTimeout(() => {
        bmoWrapper.style.transform = '';
        i++;
        if (i < times) setTimeout(tick, 80);
        else setTimeout(() => { bmoWrapper.style.transition = ''; }, dur);
      }, dur/2);
    }, dur/2);
  }
  tick();
}

function wiggle(times = 3) {
  let i = 0;
  function tick() {
    if (i >= times) return;
    bmoWrapper.style.transition = 'transform 0.1s ease-in-out';
    bmoWrapper.style.transform = `rotate(${i % 2 ? 5 : -5}deg)`;
    i++;
    setTimeout(tick, 100);
  }
  tick();
  setTimeout(() => {
    bmoWrapper.style.transform = '';
    setTimeout(() => { bmoWrapper.style.transition = ''; }, 150);
  }, times * 100 + 50);
}

function sway(times = 2) {
  let i = 0;
  function tick() {
    if (i >= times * 2) {
      bmoWrapper.style.transform = '';
      setTimeout(() => { bmoWrapper.style.transition = ''; }, 500);
      return;
    }
    bmoWrapper.style.transition = 'transform 0.5s ease-in-out';
    bmoWrapper.style.transform = `rotate(${i % 2 ? 4 : -4}deg) translateX(${i % 2 ? 5 : -5}px)`;
    i++;
    setTimeout(tick, 500);
  }
  tick();
}

function headTilt(degrees = 5, duration = 1000) {
  bmoWrapper.style.transition = 'transform 0.4s ease-in-out';
  bmoWrapper.style.transform = `rotate(${degrees}deg)`;
  setTimeout(() => {
    bmoWrapper.style.transform = '';
    setTimeout(() => { bmoWrapper.style.transition = ''; }, 400);
  }, duration);
}

function jumpScare() {
  bmoWrapper.style.transition = 'transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1)';
  bmoWrapper.style.transform = 'translateY(-25px) scale(1.1)';
  setTimeout(() => {
    bmoWrapper.style.transform = 'translateY(3px) scale(0.97)';
    setTimeout(() => {
      bmoWrapper.style.transform = '';
      setTimeout(() => { bmoWrapper.style.transition = ''; }, 200);
    }, 150);
  }, 200);
}

function droopBody() {
  bmoWrapper.style.transition = 'transform 0.6s ease-in-out';
  bmoWrapper.style.transform = 'translateY(5px) rotate(-2deg) scaleY(0.97)';
  // Arms droop down
  leftArm.style.transition = 'transform 0.5s ease';
  rightArm.style.transition = 'transform 0.5s ease';
  leftArm.style.transform = 'translateY(8px)';
  rightArm.style.transform = 'translateY(8px)';
}

function puffUp() {
  bmoWrapper.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
  bmoWrapper.style.transform = 'translateY(-8px) scale(1.06)';
  setTimeout(() => {
    bmoWrapper.style.transform = 'scale(1.02)';
    setTimeout(() => {
      bmoWrapper.style.transform = '';
      setTimeout(() => { bmoWrapper.style.transition = ''; }, 300);
    }, 1000);
  }, 400);
}

function shiver(duration = 1500) {
  const start = Date.now();
  let frame;
  function tick() {
    if (Date.now() - start > duration) {
      bmoWrapper.style.transform = '';
      return;
    }
    const x = (Math.random() - 0.5) * 4;
    const r = (Math.random() - 0.5) * 3;
    bmoWrapper.style.transform = `translateX(${x}px) rotate(${r}deg)`;
    frame = requestAnimationFrame(tick);
  }
  tick();
}

function resetBodyExpression() {
  bmoWrapper.style.transition = 'transform 0.3s ease';
  bmoWrapper.style.transform = '';
  leftArm.style.transition = 'transform 0.3s ease';
  rightArm.style.transition = 'transform 0.3s ease';
  leftArm.style.transform = '';
  rightArm.style.transform = '';
  setTimeout(() => {
    bmoWrapper.style.transition = '';
    leftArm.style.transition = '';
    rightArm.style.transition = '';
    leftArm.style.animation = '';
    rightArm.style.animation = '';
  }, 300);
}

// ─── Sparkles & Particles ────────────────────────
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

function spawnHearts(count = 4) {
  if (!sparklesDiv) return;
  const hearts = ['❤️', '💕', '💖', '💗', '💘'];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'sparkle';
    el.textContent = hearts[Math.floor(Math.random() * hearts.length)];
    el.style.left = (25 + Math.random() * 50) + '%';
    el.style.top = (15 + Math.random() * 35) + '%';
    el.style.animationDelay = (Math.random() * 0.8) + 's';
    el.style.fontSize = (14 + Math.random() * 10) + 'px';
    sparklesDiv.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }
}

// ─── Screen Color Pulse (during speaking) ────────
let screenPulseInterval = null;
function startScreenPulse(baseColor, accentColor) {
  stopScreenPulse();
  let toggle = false;
  screenPulseInterval = setInterval(() => {
    setScreenColor(toggle ? baseColor : (accentColor || baseColor));
    toggle = !toggle;
  }, 800);
}
function stopScreenPulse() {
  clearInterval(screenPulseInterval);
  screenPulseInterval = null;
}

// ─── Eye Glance During Speech ────────────────────
let eyeGlanceInterval = null;
function startEyeGlances() {
  stopEyeGlances();
  eyeGlanceInterval = setInterval(() => {
    if (currentState !== 'speaking') { stopEyeGlances(); return; }
    const dirs = ['left', 'right', 'up', 'left', 'right'];
    const dir = dirs[Math.floor(Math.random() * dirs.length)];
    const offsets = { left: { x: -3, y: 0 }, right: { x: 3, y: 0 }, up: { x: 0, y: -2 } };
    const o = offsets[dir];
    [leftEyeDot, rightEyeDot].forEach(e => {
      if (!e || e.style.display === 'none') return;
      e.style.transition = 'transform 0.25s ease';
      e.style.transform = `translate(${o.x}px, ${o.y}px)`;
    });
    setTimeout(() => {
      [leftEyeDot, rightEyeDot].forEach(e => {
        if (!e || e.style.display === 'none') return;
        e.style.transform = '';
      });
    }, 400);
  }, 1200 + Math.random() * 1000);
}
function stopEyeGlances() {
  clearInterval(eyeGlanceInterval);
  eyeGlanceInterval = null;
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
let currentSpeakSequence = ['closed', 'open', 'o', 'open', 'wide', 'closed', 'o', 'open'];
let currentSpeakSpeed = 160;
let mouthIdx = 0;

function startMouthCycle(sequence, speed) {
  mouthIdx = 0;
  if (sequence) currentSpeakSequence = sequence;
  if (speed) currentSpeakSpeed = speed;
  clearInterval(mouthCycleInterval);
  mouthCycleInterval = setInterval(() => {
    setMouth(currentSpeakSequence[mouthIdx % currentSpeakSequence.length]);
    mouthIdx++;
  }, currentSpeakSpeed);
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

let currentAudio = null;
let currentEmotionProfile = null;

function doSpeak(text, emotion, doneCallback, audioPath, audioDuration) {
  setState('speaking');
  
  // Get emotion profile
  const profile = EMOTION_PROFILES[emotion] || EMOTION_PROFILES.idle;
  currentEmotionProfile = profile;
  
  // Apply emotion-specific screen color
  setScreenColor(profile.screenColor);
  
  // Apply eye style for this emotion
  setEyeStyle(profile.eyeStyle);
  
  // Run entry animation if present
  if (profile.entryAnim) profile.entryAnim();
  
  // Apply emotion body class
  if (profile.bodyClass) bmoWrapper.classList.add(profile.bodyClass);
  
  showBubble(text);
  
  // Start mouth cycle with emotion-specific sequence and speed
  startMouthCycle(profile.speakMouths, profile.mouthCycleSpeed);
  
  // Eye glances during speech (more for calm emotions, less for intense)
  if (profile.armIntensity < 1.5) startEyeGlances();
  
  // Screen color pulse for excited emotions
  if (['excited', 'surprised', 'scared'].includes(emotion)) {
    startScreenPulse(profile.screenColor, 'idle');
  }

  if (isSitting) standUp();

  function finishSpeaking() {
    stopMouthCycle();
    stopEyeGlances();
    stopScreenPulse();
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    
    // Remove emotion body class
    if (profile.bodyClass) bmoWrapper.classList.remove(profile.bodyClass);

    // Emotion-specific exit animations
    if (['happy', 'excited', 'love', 'proud'].includes(emotion)) {
      doHappy(() => { returnToIdle(doneCallback); });
    } else if (emotion === 'sad') {
      // Slow fade back
      setMouth('sad');
      setTimeout(() => {
        setMouth('tiny');
        setTimeout(() => {
          hideBubble();
          returnToIdle(doneCallback);
        }, 600);
      }, 800);
    } else if (emotion === 'surprised') {
      setMouth('o');
      quickBounce(1);
      setTimeout(() => {
        hideBubble();
        returnToIdle(doneCallback);
      }, 500);
    } else {
      hideBubble();
      returnToIdle(doneCallback);
    }
  }

  // Use audio duration if available, otherwise estimate from text
  const duration = audioDuration || Math.max(1500, text.length * 50);
  setTimeout(finishSpeaking, duration + 500);
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
  resetEyes();
  resetBodyExpression();
  setScreenColor('idle');
  currentEmotionProfile = null;
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

  const text          = msg.text          || '';
  const emotion       = detectEmotion(msg.emotion, text);
  const audioPath     = msg.audioPath     || null;
  const audioDuration = msg.audioDuration || null;

  // Emotion-aware thinking phase
  const profile = EMOTION_PROFILES[emotion] || EMOTION_PROFILES.idle;
  
  // Quick emotions skip think phase, go straight to speaking
  if (['excited', 'surprised', 'scared'].includes(emotion)) {
    doSpeak(text, emotion, () => { isAnimating = false; }, audioPath, audioDuration);
  } else {
    doThink(() => {
      doSpeak(text, emotion, () => {
        isAnimating = false;
      }, audioPath, audioDuration);
    });
  }
}

// ─── Smart Emotion Detection ─────────────────────
// Enhance bridge-detected emotion with text analysis
function detectEmotion(bridgeEmotion, text) {
  // If bridge already set a specific emotion, trust it
  if (bridgeEmotion && bridgeEmotion !== 'idle' && EMOTION_PROFILES[bridgeEmotion]) {
    return bridgeEmotion;
  }
  
  const lower = (text || '').toLowerCase();
  
  // Check for strong signals in text
  if (/\b(love|❤️|💕|heart|adore)\b/i.test(lower)) return 'love';
  if (/(!{2,}|🎉|🎊|amazing|incredible|awesome|insane|holy shit|fuck(ing)? (cool|awesome|brilliant))/i.test(lower)) return 'excited';
  if (/(\?{2,}|hmm|wonder|curious|interesting|what if)/i.test(lower)) return 'curious';
  if (/(😂|lol|lmao|haha|😏|sneaky|trick|mischie)/i.test(lower)) return 'mischief';
  if (/(🎉|nice|great|well done|proud|nailed|killed it|congrat)/i.test(lower)) return 'proud';
  if (/(sorry|sad|unfortunately|bad news|😢|😞)/i.test(lower)) return 'sad';
  if (/(⚠️|careful|warning|watch out|oh no|shit|fuck(?!ing (cool|awesome|brilliant)))/i.test(lower)) return 'scared';
  if (/(whoa|wow|😱|😮|unexpected|surprise|wait what)/i.test(lower)) return 'surprised';
  if (/(👋|hey|hello|happy|😊|🙌|great|good|cool)/i.test(lower)) return 'happy';
  
  return bridgeEmotion || 'idle';
}

// ─── Click Reactions ─────────────────────────────
const CLICK_REACTIONS = [
  // Happy sparkle
  () => { setMouth('happy'); setHappyEyes(true); spawnSparkles(4); setScreenColor('happy');
    setTimeout(() => { setMouth('closed'); setHappyEyes(false); setScreenColor('idle'); }, 1500); },
  // Surprised
  () => { setMouth('surprise'); setEyeStyle('wide'); setScreenColor('excited'); jumpScare();
    setTimeout(() => { setMouth('closed'); resetEyes(); setScreenColor('idle'); }, 800); },
  // Wave
  () => { doWave(); setMouth('smile'); setTimeout(() => setMouth('closed'), 1000); },
  // Big grin
  () => { setMouth('grin'); setHappyEyes(true); spawnSparkles(6); setScreenColor('happy');
    setTimeout(() => { setMouth('closed'); setHappyEyes(false); setScreenColor('idle'); }, 2000); },
  // Squish
  () => { 
    bmoWrapper.classList.add('clicked');
    setTimeout(() => bmoWrapper.classList.remove('clicked'), 150);
    setMouth('o'); setEyeStyle('wide');
    setTimeout(() => { setMouth('closed'); resetEyes(); }, 600);
  },
  // Spin!
  () => {
    setMouth('happy'); setHappyEyes(true);
    bmoWrapper.style.transition = 'transform 0.5s ease-in-out';
    bmoWrapper.style.transform = 'rotate(360deg)';
    setTimeout(() => { bmoWrapper.style.transform = ''; bmoWrapper.style.transition = '';
      setMouth('closed'); setHappyEyes(false); }, 600);
  },
  // Shy blush — look away + tiny smile
  () => {
    setMouth('tiny'); eyeLookDirection('left', 1200); setScreenColor('love');
    setTimeout(() => { setMouth('smile'); }, 400);
    setTimeout(() => { setMouth('closed'); setScreenColor('idle'); }, 1500);
  },
  // Mischievous wink (one eye closes)
  () => {
    setMouth('smirk'); setScreenColor('mischief');
    if (leftEyeDot) { leftEyeDot.style.transition = 'transform 0.15s'; leftEyeDot.style.transform = 'scaleY(0.05)'; }
    setTimeout(() => {
      if (leftEyeDot) { leftEyeDot.style.transform = ''; setTimeout(() => { leftEyeDot.style.transition = ''; }, 200); }
      setMouth('closed'); setScreenColor('idle');
    }, 1000);
  },
  // Love burst
  () => {
    setMouth('bigSmile'); setHappyEyes(true); setScreenColor('love'); spawnHearts(5); quickBounce(1);
    setTimeout(() => { setMouth('closed'); setHappyEyes(false); setScreenColor('idle'); }, 2000);
  },
  // Dizzy spin
  () => {
    setMouth('o');
    let spins = 0;
    const spinInterval = setInterval(() => {
      bmoWrapper.style.transform = `rotate(${spins * 120}deg)`;
      bmoWrapper.style.transition = 'transform 0.15s linear';
      spins++;
      if (spins > 4) {
        clearInterval(spinInterval);
        bmoWrapper.style.transform = '';
        bmoWrapper.style.transition = '';
        // Dizzy eyes
        [leftEyeDot, rightEyeDot].forEach(e => {
          if (!e) return;
          e.style.transition = 'transform 0.5s ease';
          e.style.transform = 'rotate(90deg) scale(0.8)';
        });
        setMouth('surprise');
        setTimeout(() => { resetEyes(); setMouth('closed'); }, 1200);
      }
    }, 120);
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

// ─── Window Physics (drag + gravity drop) ────────
const physics = {
  isDragging: false,
  velocity: { x: 0, y: 0 },
  gravity: 1800,        // pixels/sec²
  bounce: 0.45,         // energy retained on bounce
  friction: 0.95,       // air resistance
  dragStart: { mx: 0, my: 0, wx: 0, wy: 0 },
  lastDragPos: { x: 0, y: 0 },
  lastDragTime: 0,
  falling: false,
  screenBounds: null,
  windowSize: { w: 320, h: 540 },
};

// Get screen bounds once
if (window.joemac && window.joemac.getScreenBounds) {
  window.joemac.getScreenBounds().then(b => { physics.screenBounds = b; });
}

// Manual drag handling
bmoWrapper.addEventListener('mousedown', async (e) => {
  if (!window.joemac || !window.joemac.getWindowPos) return;
  
  physics.isDragging = true;
  physics.falling = false;
  physics.velocity = { x: 0, y: 0 };
  
  const pos = await window.joemac.getWindowPos();
  physics.dragStart = { mx: e.screenX, my: e.screenY, wx: pos.x, wy: pos.y };
  physics.lastDragPos = { x: pos.x, y: pos.y };
  physics.lastDragTime = performance.now();
  
  // Scared face + tilt on pickup
  setMouth('surprise');
  setScreenColor('excited');
  bmoWrapper.style.transition = 'transform 0.15s';
  bmoWrapper.style.transform = 'rotate(-5deg) scaleY(0.95)';
  
  // Flailing arms
  leftArm.style.animation = 'arm-flail-left 0.3s ease-in-out infinite';
  rightArm.style.animation = 'arm-flail-right 0.3s ease-in-out infinite';
  
  setTimeout(() => { bmoWrapper.style.transition = ''; }, 150);
});

window.addEventListener('mousemove', (e) => {
  if (!physics.isDragging) return;
  
  const nx = physics.dragStart.wx + (e.screenX - physics.dragStart.mx);
  const ny = physics.dragStart.wy + (e.screenY - physics.dragStart.my);
  
  // Track velocity from drag movement
  const now = performance.now();
  const dt = (now - physics.lastDragTime) / 1000;
  if (dt > 0) {
    physics.velocity.x = (nx - physics.lastDragPos.x) / dt;
    physics.velocity.y = (ny - physics.lastDragPos.y) / dt;
  }
  physics.lastDragPos = { x: nx, y: ny };
  physics.lastDragTime = now;
  
  // Tilt based on horizontal movement  
  const dx = nx - physics.lastDragPos.x;
  const tilt = Math.max(-15, Math.min(15, dx * -0.8));
  bmoWrapper.style.transform = `rotate(${tilt}deg) scaleY(0.95)`;
  
  window.joemac.setWindowPos(nx, ny);
});

window.addEventListener('mouseup', async () => {
  if (!physics.isDragging) return;
  physics.isDragging = false;
  
  // Restore face and shape
  bmoWrapper.style.transform = '';
  leftArm.style.animation = '';
  rightArm.style.animation = '';
  setMouth('closed');
  setScreenColor('idle');
  
  // Start falling with current velocity
  if (!physics.screenBounds) {
    physics.screenBounds = await window.joemac.getScreenBounds();
  }
  
  const pos = await window.joemac.getWindowPos();
  physics.falling = true;
  
  let px = pos.x;
  let py = pos.y;
  let vx = physics.velocity.x * 0.5; // dampen throw
  let vy = physics.velocity.y * 0.5;
  let lastTime = performance.now();
  let bounceCount = 0;
  
  const floorY = physics.screenBounds.height - physics.windowSize.h - 55;
  
  function tick(now) {
    if (physics.isDragging || !physics.falling) return;
    
    const dt = Math.min((now - lastTime) / 1000, 0.05); // cap dt
    lastTime = now;
    
    // Apply gravity
    vy += physics.gravity * dt;
    
    // Apply air friction
    vx *= physics.friction;
    
    // Update position
    px += vx * dt;
    py += vy * dt;
    
    // Floor collision
    if (py >= floorY) {
      py = floorY;
      vy = -vy * physics.bounce;
      vx *= 0.8;
      bounceCount++;
      
      // Squish on landing
      bmoWrapper.style.transition = 'transform 0.08s';
      bmoWrapper.style.transform = 'scaleY(0.9) scaleX(1.05)';
      setTimeout(() => {
        bmoWrapper.style.transform = 'scaleY(1.02) scaleX(0.99)';
        setTimeout(() => {
          bmoWrapper.style.transform = '';
          bmoWrapper.style.transition = '';
        }, 80);
      }, 80);
      
      // Stop if barely bouncing
      if (Math.abs(vy) < 30 || bounceCount > 5) {
        py = floorY;
        physics.falling = false;
        window.joemac.setWindowPos(Math.round(px), Math.round(py));
        return;
      }
    }
    
    // Wall collisions
    if (px < -50) { px = -50; vx = -vx * physics.bounce; }
    if (px > physics.screenBounds.width - 100) { 
      px = physics.screenBounds.width - 100; 
      vx = -vx * physics.bounce; 
    }
    
    window.joemac.setWindowPos(Math.round(px), Math.round(py));
    requestAnimationFrame(tick);
  }
  
  requestAnimationFrame(tick);
});

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
