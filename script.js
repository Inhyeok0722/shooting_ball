/* =========================================================================
   [전역 변수 및 캔버스 초기화]
========================================================================= */

const GAME_STATE = {
  START: 'START',
  PLAYING: 'PLAYING',
  GAMEOVER: 'GAMEOVER'
};
let currentState = GAME_STATE.START;
let winner = null;
let isSinglePlayer = false;
let scores = { p1: 0, p2: 0 };
let screenShake = { intensity: 0 };

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 모든 수치는 "60fps 기준 프레임 단위" — update() 내부에서 dtF(= dt*60)를 곱해 적용
const SETTINGS = {
  PLAYER_SPEED: 6,
  PLAYER_ACCEL: 0.5,
  PLAYER_FRICTION: 0.92,      // 1프레임당 감속 비율 (지수 마찰로 변환됨)
  BULLET_SPEED: 24,
  SHOOT_COOLDOWN: 15,         // 단위: 60fps 기준 프레임
  RELOAD_SPEED_MULTIPLIER: 0.5,
  MAX_HP: 5,
  MAX_AMMO: 10,
  RELOAD_TIME: 150,           // 단위: 60fps 기준 프레임
  NORMAL_FONT_COLOR: 'rgba(0, 0, 0, 0.6)',
  DASH_COOLDOWN: 180,         // 단위: 60fps 기준 프레임
  DASH_SPEED_MULTIPLIER: 3,
  DASH_DURATION: 12           // 단위: 60fps 기준 프레임
};

// deltaTime 기반으로 전환 — FPS 고정 제거
let lastTime = 0;

/* =========================================================================
   [반응형 캔버스 설정]
========================================================================= */
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const BASE_WIDTH = 1920;
const BASE_HEIGHT = 1080;

function getScale() {
  return Math.min(canvas.width / BASE_WIDTH, canvas.height / BASE_HEIGHT);
}

/* =========================================================================
   [화면 렌더링 함수 모음]
========================================================================= */

function drawStartScreen() {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawGameOver() {
  const scale = getScale();
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "white";
  ctx.font = `bold ${Math.round(60 * scale)}px Arial`;
  ctx.textAlign = "center";
  ctx.fillText(`${winner} WIN!`, canvas.width / 2, canvas.height / 2 - 20 * scale);

  ctx.font = `${Math.round(28 * scale)}px Arial`;
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillText(`Score  P1: ${scores.p1}  |  P2: ${scores.p2}`, canvas.width / 2, canvas.height / 2 + 40 * scale);

  ctx.font = `${Math.round(22 * scale)}px Arial`;
  ctx.fillStyle = "rgba(200,200,200,0.7)";
  ctx.fillText("Press R to Restart", canvas.width / 2, canvas.height / 2 + 90 * scale);
}

function drawUI() {
  const scale = Math.max(getScale(), 0.6);
  const f1 = Math.round(18 * scale);
  const f2 = Math.round(13 * scale);
  const f3 = Math.round(16 * scale);
  const lh = Math.round(26 * scale);

  ctx.textAlign = "center";
  ctx.font = `bold ${Math.round(20 * scale)}px Arial`;
  ctx.fillStyle = SETTINGS.NORMAL_FONT_COLOR;
  ctx.fillText(`${scores.p1}  :  ${scores.p2}`, canvas.width / 2, lh);

  ctx.textAlign = "left";
  ctx.font = `bold ${f1}px Arial`;
  ctx.fillStyle = SETTINGS.NORMAL_FONT_COLOR;
  ctx.fillText("P1 (Blue)", 20, lh);
  ctx.font = `${f2}px Arial`;
  ctx.fillText("Move: W A S D | Shoot: F | Reload: R | Dash: Shift", 20, lh + f2 + 4);
  ctx.font = `bold ${f3}px Arial`;
  ctx.fillStyle = p1.isReloading ? "orange" : SETTINGS.NORMAL_FONT_COLOR;
  ctx.fillText(`Ammo: ${p1.isReloading ? "RELOADING..." : p1.ammo + " / " + SETTINGS.MAX_AMMO}`, 20, lh + f2 + 4 + f3 + 4);

  ctx.textAlign = "right";
  ctx.fillStyle = SETTINGS.NORMAL_FONT_COLOR;
  ctx.font = `bold ${f1}px Arial`;
  ctx.fillText(isSinglePlayer ? "P2 (CPU)" : "P2 (Red)", canvas.width - 20, lh);
  ctx.font = `${f2}px Arial`;
  ctx.fillText(isSinglePlayer ? "CPU Managed" : "Move: I J K L | Shoot: ; | Reload: P | Dash: Enter", canvas.width - 20, lh + f2 + 4);
  ctx.font = `bold ${f3}px Arial`;
  ctx.fillStyle = p2.isReloading ? "orange" : SETTINGS.NORMAL_FONT_COLOR;
  ctx.fillText(`Ammo: ${p2.isReloading ? "RELOADING..." : p2.ammo + " / " + SETTINGS.MAX_AMMO}`, canvas.width - 20, lh + f2 + 4 + f3 + 4);
}

function resetGame() {
  p1.x = canvas.width * 0.1; p1.y = canvas.height * 0.6;
  p1.vx = 0; p1.vy = 0;
  p1.hp = SETTINGS.MAX_HP; p1.ammo = SETTINGS.MAX_AMMO; p1.isReloading = false;
  p1.dashCooldown = 0; p1.dashTimer = 0;
  p1.stunTimer = 0; p1.healTimer = 0; p1.invTimer = 0;

  p2.x = canvas.width * 0.9; p2.y = canvas.height * 0.4;
  p2.vx = 0; p2.vy = 0;
  p2.hp = SETTINGS.MAX_HP; p2.ammo = SETTINGS.MAX_AMMO; p2.isReloading = false;
  p2.dashCooldown = 0; p2.dashTimer = 0;
  p2.stunTimer = 0; p2.healTimer = 0; p2.invTimer = 0;

  bullets.length = 0;
  particles.length = 0;
  if (typeof initMapElements === 'function') initMapElements();
  currentState = GAME_STATE.START;
  winner = null;
  screenShake.intensity = 0;
  // scores는 의도적으로 초기화하지 않음 (라운드 간 유지)
}

/* =========================================================================
   [유틸리티 함수 모음]
========================================================================= */

function isColliding(a, b) {
  const scale = getScale();
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy) < ((a.radius * scale) + (b.radius * scale));
}

function isCollidingRect(circle, rect) {
  const scale = getScale();
  const scaledRadius = circle.radius * scale;

  let testX = circle.x;
  let testY = circle.y;

  if (circle.x < rect.x) testX = rect.x;
  else if (circle.x > rect.x + rect.width) testX = rect.x + rect.width;

  if (circle.y < rect.y) testY = rect.y;
  else if (circle.y > rect.y + rect.height) testY = rect.y + rect.height;

  const distX = circle.x - testX;
  const distY = circle.y - testY;
  return Math.sqrt(distX * distX + distY * distY) <= scaledRadius;
}

function invertColor(c) {
  return { r: 255 - c.r, g: 255 - c.g, b: 255 - c.b };
}

/* =========================================================================
   [클래스 모음]
========================================================================= */

class GameObject {
  constructor(x, y, color) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.accel = SETTINGS.PLAYER_ACCEL;
    this.friction = SETTINGS.PLAYER_FRICTION;
    this.maxSpeed = SETTINGS.PLAYER_SPEED;
    this.color = color;
    this.radius = 15;
    this.dir = { x: 0, y: -1 };
  }

  // dt: 경과 시간(초)
  // dtF = dt * 60: 60fps 기준으로 환산한 "가상 프레임 수"
  // → 모든 수치가 60fps 기준으로 설계되어 있으므로 dtF를 곱하면 fps에 무관한 결과를 얻음
  update(canvasWidth, canvasHeight, dt) {
    const dtF = dt * 60;

    // 지수 마찰: pow(friction, dtF) → 어떤 fps에서도 동일한 감속 곡선 보장
    // 예) 30fps(dtF=2): pow(0.92,2)=0.846 ≈ 60fps 2프레임 적용과 동일
    this.vx *= Math.pow(this.friction, dtF);
    this.vy *= Math.pow(this.friction, dtF);

    if (Math.abs(this.vx) < 0.01) this.vx = 0;
    if (Math.abs(this.vy) < 0.01) this.vy = 0;

    this.x += this.vx * dtF;
    this.y += this.vy * dtF;

    this.checkBoundary(canvasWidth, canvasHeight);
  }

  checkBoundary(width, height) {
    if (this.x < this.radius) { this.x = this.radius; this.vx *= -1; }
    else if (this.x > width - this.radius) { this.x = width - this.radius; this.vx *= -1; }

    if (this.y < this.radius) { this.y = this.radius; this.vy *= -1; }
    else if (this.y > height - this.radius) { this.y = height - this.radius; this.vy *= -1; }
  }

  draw(ctx) {
    const scale = getScale();
    let c = this.hitTimer > 0 ? invertColor(this.color) : this.color;

    ctx.fillStyle = `rgb(${c.r}, ${c.g}, ${c.b})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
  }
}

class Player extends GameObject {
  constructor(x, y, color, controls) {
    super(x, y, color);
    this.controls = controls;
    this.hp = SETTINGS.MAX_HP;
    this.cooldown = 0;
    this.hitTimer = 0;

    this.ammo = SETTINGS.MAX_AMMO;
    this.reloadTimer = 0;
    this.isReloading = false;

    this.dashCooldown = 0;
    this.dashTimer = 0;

    this.stunTimer = 0;
    this.healTimer = 0;
    this.invTimer = 0;
  }

  handleInput(keys, dt) {
    let dx = 0; let dy = 0;
    const scale = getScale();
    const dtF = dt * 60;

    if (keys[this.controls.dash] && this.dashCooldown <= 0) {
      this.dashTimer = SETTINGS.DASH_DURATION;
      this.dashCooldown = SETTINGS.DASH_COOLDOWN;
    }

    if (this.dashTimer > 0) {
      const dashSpeed = this.maxSpeed * SETTINGS.DASH_SPEED_MULTIPLIER * scale;
      let dirX = this.dir.x || 1;
      let dirY = this.dir.y || 0;
      this.vx = dirX * dashSpeed;
      this.vy = dirY * dashSpeed;
      return;
    }

    let accelMult = this.isReloading ? SETTINGS.RELOAD_SPEED_MULTIPLIER : 1;
    let speedMult = this.isReloading ? SETTINGS.RELOAD_SPEED_MULTIPLIER : 1;

    if (this.stunTimer > 0) {
      accelMult *= 0.3;
      speedMult *= 0.3;
    }

    // 가속도에 dtF를 곱해 fps 무관하게 동일한 가속감 보장
    const currentAccel = this.accel * accelMult * scale * dtF;
    const currentMaxSpeed = this.maxSpeed * speedMult * scale;

    if (keys[this.controls.up])    { this.vy -= currentAccel; dy -= 1; }
    if (keys[this.controls.down])  { this.vy += currentAccel; dy += 1; }
    if (keys[this.controls.left])  { this.vx -= currentAccel; dx -= 1; }
    if (keys[this.controls.right]) { this.vx += currentAccel; dx += 1; }

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      this.dir = { x: dx / len, y: dy / len };
    }

    this.vx = Math.max(-currentMaxSpeed, Math.min(currentMaxSpeed, this.vx));
    this.vy = Math.max(-currentMaxSpeed, Math.min(currentMaxSpeed, this.vy));
  }

  shoot(bullets) {
    const scale = getScale();
    if (this.cooldown > 0 || this.isReloading) return;

    if (this.ammo > 0) {
      this.ammo--;
      this.cooldown = SETTINGS.SHOOT_COOLDOWN;

      bullets.push(new Bullet(
        this.x, this.y,
        this.dir.x * SETTINGS.BULLET_SPEED * scale,
        this.dir.y * SETTINGS.BULLET_SPEED * scale,
        this.color, this
      ));

      if (this.ammo === 0) this.startReload();
    }
  }

  startReload() {
    if (!this.isReloading && this.ammo < SETTINGS.MAX_AMMO) {
      this.isReloading = true;
      this.reloadTimer = SETTINGS.RELOAD_TIME;
    }
  }

  update(canvasWidth, canvasHeight, dt) {
    super.update(canvasWidth, canvasHeight, dt);
    const dtF = dt * 60;

    // 모든 타이머를 dtF만큼 감소 → fps에 무관한 쿨타임/지속시간 보장
    if (this.cooldown > 0)     this.cooldown -= dtF;
    if (this.hitTimer > 0)     this.hitTimer -= dtF;
    if (this.dashCooldown > 0) this.dashCooldown -= dtF;
    if (this.dashTimer > 0) {
      this.dashTimer -= dtF;
      this.hitTimer = 2;
    }
    if (this.stunTimer > 0) this.stunTimer -= dtF;
    if (this.invTimer > 0)  this.invTimer -= dtF;

    if (this.isReloading) {
      this.reloadTimer -= dtF;
      if (this.reloadTimer <= 0) {
        this.ammo = SETTINGS.MAX_AMMO;
        this.isReloading = false;
      }
    }
  }

  draw(ctx) {
    const scale  = getScale();
    const r      = this.radius * scale;
    const angle  = Math.atan2(this.dir.y, this.dir.x);
    const c      = this.hitTimer > 0 ? invertColor(this.color) : this.color;

    // 색상 팔레트
    const main  = `rgb(${c.r},${c.g},${c.b})`;
    const dark  = `rgb(${Math.floor(c.r*0.35)},${Math.floor(c.g*0.35)},${Math.floor(c.b*0.35)})`;
    const light = `rgb(${Math.min(255,c.r+110)},${Math.min(255,c.g+110)},${Math.min(255,c.b+110)})`;

    // ── 캐릭터 본체 (로컬 좌표: 오른쪽 = 정면) ──────────────────
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);

    // 바닥 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(r*0.12, r*0.1, r*0.9, r*0.7, 0, 0, Math.PI*2);
    ctx.fill();

    // 다리 (뒤쪽으로 두 개 돌출)
    ctx.fillStyle = dark;
    for (const s of [1, -1]) {
      ctx.beginPath();
      ctx.ellipse(-r*0.28, s*r*0.52, r*0.22, r*0.3, 0, 0, Math.PI*2);
      ctx.fill();
    }

    // 몸통
    ctx.fillStyle = main;
    ctx.beginPath();
    ctx.ellipse(r*0.05, 0, r*0.76, r*0.62, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = r * 0.13;
    ctx.stroke();

    // 방탄복 디테일 (중앙 반투명 타원)
    ctx.fillStyle = dark;
    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    ctx.ellipse(-r*0.05, 0, r*0.38, r*0.44, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // 총 쥔 팔
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(r*0.28, r*0.44, r*0.23, r*0.19, -0.25, 0, Math.PI*2);
    ctx.fill();

    // 총기 본체
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath();
    ctx.roundRect(r*0.08, r*0.29, r*1.05, r*0.23, r*0.06);
    ctx.fill();

    // 총기 손잡이
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.roundRect(r*0.19, r*0.43, r*0.14, r*0.23, r*0.04);
    ctx.fill();

    // 탄창
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.roundRect(r*0.50, r*0.44, r*0.15, r*0.18, r*0.03);
    ctx.fill();

    // 총구
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.rect(r*0.98, r*0.31, r*0.18, r*0.19);
    ctx.fill();

    // 총구 구멍
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(r*1.16, r*0.405, r*0.055, 0, Math.PI*2);
    ctx.fill();

    // 머리
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.arc(r*0.17, 0, r*0.45, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = r * 0.1;
    ctx.stroke();

    // 헬멧 바이저
    ctx.fillStyle = 'rgba(0,0,0,0.48)';
    ctx.beginPath();
    ctx.ellipse(r*0.27, 0, r*0.23, r*0.15, 0, 0, Math.PI*2);
    ctx.fill();

    // 눈 흰자
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    for (const s of [1, -1]) {
      ctx.beginPath();
      ctx.arc(r*0.38, s*r*0.14, r*0.075, 0, Math.PI*2);
      ctx.fill();
    }

    // 눈동자
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    for (const s of [1, -1]) {
      ctx.beginPath();
      ctx.arc(r*0.41, s*r*0.14, r*0.038, 0, Math.PI*2);
      ctx.fill();
    }

    ctx.restore();

    // ── 플레이어 위 UI (월드 좌표) ───────────────────────────────
    const barWidth = 10;
    const barHeight = 6;
    const spacing = 3;
    const totalBarWidth = (barWidth * SETTINGS.MAX_HP) + (spacing * (SETTINGS.MAX_HP - 1));
    const startX = this.x - totalBarWidth / 2;
    const startY = this.y - r - 22;

    // 체력 바
    for (let i = 0; i < SETTINGS.MAX_HP; i++) {
      if (i < this.hp) {
        ctx.fillStyle = main;
        ctx.fillRect(startX + i * (barWidth + spacing), startY, barWidth, barHeight);
      } else {
        ctx.strokeStyle = 'rgba(100,100,100,0.5)';
        ctx.strokeRect(startX + i * (barWidth + spacing), startY, barWidth, barHeight);
      }
    }

    // 대시 쿨타임 바
    const dashBarY = startY + barHeight + 4;
    ctx.fillStyle = 'rgba(100,100,100,0.5)';
    ctx.fillRect(startX, dashBarY, totalBarWidth, 4);
    ctx.fillStyle = 'yellow';
    ctx.fillRect(startX, dashBarY, totalBarWidth * (1 - this.dashCooldown / SETTINGS.DASH_COOLDOWN), 4);

    // 재장전 아크
    if (this.isReloading) {
      const progress = 1 - (this.reloadTimer / SETTINGS.RELOAD_TIME);
      ctx.strokeStyle = 'rgba(255,165,0,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
    }
  }
}

class Bullet extends GameObject {
  constructor(x, y, vx, vy, color, owner) {
    super(x, y, color);
    this.vx = vx; this.vy = vy;
    this.radius = 5;
    this.life = 100;
    this.friction = 1;
    this.owner = owner;
  }

  // 총알은 벽에서 반사되지 않고 즉시 소멸
  checkBoundary(width, height) {
    if (this.x - this.radius < 0 || this.x + this.radius > width ||
        this.y - this.radius < 0 || this.y + this.radius > height) {
      this.life = 0;
    }
  }

  update(canvasWidth, canvasHeight, dt) {
    super.update(canvasWidth, canvasHeight, dt);
    this.life -= dt * 60;
  }

  isAlive() {
    return this.life > 0;
  }

  // 총알: 발사 방향을 향한 타원형 탄환
  draw(ctx) {
    if (!this.isAlive()) return;
    const scale  = getScale();
    const angle  = Math.atan2(this.vy, this.vx);
    const r      = this.radius * scale;
    const alpha  = Math.min(1, this.life / 20); // 수명 끝날수록 투명해짐
    const c      = this.color;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;

    // 탄환 광원 (밝은 코어)
    ctx.fillStyle = '#ffffaa';
    ctx.beginPath();
    ctx.ellipse(0, 0, r*1.6, r*0.6, 0, 0, Math.PI*2);
    ctx.fill();

    // 탄환 본체 (발사자 색상)
    ctx.fillStyle = `rgb(${c.r},${c.g},${c.b})`;
    ctx.beginPath();
    ctx.ellipse(-r*0.1, 0, r*1.3, r*0.45, 0, 0, Math.PI*2);
    ctx.fill();

    // 탄환 꼬리 흔적
    ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},0.35)`;
    ctx.beginPath();
    ctx.ellipse(-r*1.2, 0, r*1.0, r*0.28, 0, 0, Math.PI*2);
    ctx.fill();

    ctx.globalAlpha = 1.0;
    ctx.restore();
  }
}

/* =========================================================================
   [장애물 & 파티클 클래스]
========================================================================= */
class Obstacle {
  constructor(xRatio, yRatio, wRatio, hRatio, color, maxHp = 10) {
    this.xRatio = xRatio; this.yRatio = yRatio;
    this.wRatio = wRatio; this.hRatio = hRatio;
    this.color = color;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.x = 0; this.y = 0; this.width = 0; this.height = 0;
  }

  update(canvasWidth, canvasHeight) {
    this.x = canvasWidth * this.xRatio;
    this.y = canvasHeight * this.yRatio;
    this.width = canvasWidth * this.wRatio;
    this.height = canvasHeight * this.hRatio;
  }

  draw(ctx) {
    ctx.globalAlpha = Math.max(0.2, this.hp / this.maxHp);
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(this.x + 5, this.y + this.height / 2 - 2, this.width - 10, 4);
    ctx.fillStyle = "white";
    ctx.fillRect(this.x + 5, this.y + this.height / 2 - 2, (this.width - 10) * (this.hp / this.maxHp), 4);

    ctx.strokeStyle = "#444";
    ctx.lineWidth = 3;
    ctx.strokeRect(this.x, this.y, this.width, this.height);
    ctx.globalAlpha = 1.0;
  }
}

class HealingZone {
  constructor(xRatio, yRatio) {
    this.xRatio = xRatio;
    this.yRatio = yRatio;
    this.x = 0; this.y = 0; this.radius = 0;
    this.pulse = 0;
  }

  update(canvasWidth, canvasHeight, dt) {
    this.x = canvasWidth * this.xRatio;
    this.y = canvasHeight * this.yRatio;
    const scale = getScale();
    this.radius = 100 * scale;
    this.pulse += 0.05 * dt * 60;
  }

  draw(ctx) {
    const alpha = 0.2 + Math.sin(this.pulse) * 0.1;
    ctx.fillStyle = `rgba(0, 255, 100, ${alpha})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();

    ctx.strokeStyle = "rgba(0, 200, 50, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.closePath();

    ctx.fillStyle = "rgba(0, 255, 100, 0.8)";
    ctx.font = `bold ${20 * getScale()}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("+", this.x, this.y);
  }
}

class Particle extends GameObject {
  constructor(x, y, color) {
    super(x, y, color);
    this.radius = Math.random() * 3 + 2;
    this.vx = (Math.random() - 0.5) * 15;
    this.vy = (Math.random() - 0.5) * 15;
    this.life = 20;
    this.friction = 0.85;
  }

  update(canvasWidth, canvasHeight, dt) {
    super.update(canvasWidth, canvasHeight, dt);
    this.life -= dt * 60;
  }

  draw(ctx) {
    if (this.life <= 0) return;
    const scale = getScale();
    const alpha = Math.max(0, this.life / 20);
    ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
  }
}

/* =========================================================================
   [인스턴스 생성 및 데이터 배열 초기화]
========================================================================= */
const keys = {};
const bullets = [];
const particles = [];
const obstacles = [];
const healingZones = [];

function initMapElements() {
  obstacles.length = 0;
  healingZones.length = 0;
  healingZones.push(new HealingZone(0.5, 0.5));
  obstacles.push(new Obstacle(0.35, 0.4, 0.03, 0.2, "gray", 15));
  obstacles.push(new Obstacle(0.62, 0.4, 0.03, 0.2, "gray", 15));
}
initMapElements();

const p1 = new Player(canvas.width * 0.1, canvas.height * 0.6, { r: 0, g: 0, b: 255 }, {
  up: 'w', down: 's', left: 'a', right: 'd', shoot: 'f', reload: 'r', dash: 'shift'
});

let p2 = new Player(canvas.width * 0.9, canvas.height * 0.4, { r: 255, g: 0, b: 0 }, {
  up: 'i', down: 'k', left: 'j', right: 'l', shoot: ';', reload: 'p', dash: 'enter'
});

/* =========================================================================
   [CPU AI 클래스]
========================================================================= */
class CPUPlayer extends Player {
  constructor(x, y, color) {
    super(x, y, color, { up: 'cpu_up', down: 'cpu_down', left: 'cpu_left', right: 'cpu_right', shoot: 'cpu_shoot', reload: 'cpu_reload', dash: 'cpu_dash' });
  }

  updateAI(target, bullets, obstacles, canvasWidth, canvasHeight, dt) {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 0) {
      this.dir = { x: dx / dist, y: dy / dist };
    }

    const aiKeys = {};

    if (this.dashCooldown <= 0) {
      for (const b of bullets) {
        if (b.owner === this) continue;
        const bdx = this.x - b.x;
        const bdy = this.y - b.y;
        const bdist = Math.hypot(bdx, bdy);
        if (bdist < 150) {
          const dot = (b.vx * bdx + b.vy * bdy) / bdist;
          if (dot > 15) {
            aiKeys[this.controls.dash] = true;
            break;
          }
        }
      }
    }

    let targetX = target.x;
    let targetY = target.y;
    let moveMode = 'CHASE';

    if (this.hp <= 2) {
      moveMode = 'HEAL';
      targetX = canvasWidth * 0.5;
      targetY = canvasHeight * 0.5;
    } else if (this.ammo === 0) {
      moveMode = 'HIDE';
      let bestObstacle = null;
      let minDist = Infinity;
      obstacles.forEach(obs => {
        const obsCX = obs.x + obs.width / 2;
        const obsCY = obs.y + obs.height / 2;
        const d = Math.hypot(this.x - obsCX, this.y - obsCY);
        if (d < minDist) {
          minDist = d;
          bestObstacle = obs;
        }
      });

      if (bestObstacle) {
        const obsCX = bestObstacle.x + bestObstacle.width / 2;
        const obsCY = bestObstacle.y + bestObstacle.height / 2;
        const hideDirX = obsCX - target.x;
        const hideDirY = obsCY - target.y;
        const hideLen = Math.hypot(hideDirX, hideDirY);
        targetX = obsCX + (hideDirX / hideLen) * 50;
        targetY = obsCY + (hideDirY / hideLen) * 50;
        this.startReload();
      }
    }

    const tdx = targetX - this.x;
    const tdy = targetY - this.y;
    const tdist = Math.hypot(tdx, tdy);

    if (moveMode === 'CHASE') {
      if (tdist > 450) {
        if (tdx > 20) aiKeys[this.controls.right] = true;
        if (tdx < -20) aiKeys[this.controls.left] = true;
        if (tdy > 20) aiKeys[this.controls.down] = true;
        if (tdy < -20) aiKeys[this.controls.up] = true;
      } else if (tdist < 250) {
        if (tdx > 0) aiKeys[this.controls.left] = true;
        if (tdx < 0) aiKeys[this.controls.right] = true;
        if (tdy > 0) aiKeys[this.controls.up] = true;
        if (tdy < 0) aiKeys[this.controls.down] = true;
      } else {
        if (Math.sin(Date.now() / 400) > 0) {
          aiKeys[this.controls.up] = true;
        } else {
          aiKeys[this.controls.down] = true;
        }
      }
    } else {
      if (tdx > 10) aiKeys[this.controls.right] = true;
      if (tdx < -10) aiKeys[this.controls.left] = true;
      if (tdy > 10) aiKeys[this.controls.down] = true;
      if (tdy < -10) aiKeys[this.controls.up] = true;
    }

    // 발사 확률을 dtF로 스케일: 어떤 fps에서도 동일한 초당 발사 빈도 유지
    if (moveMode === 'CHASE' && dist < 700 && !this.isReloading) {
      if (Math.random() < 0.06 * (dt * 60)) {
        this.shoot(bullets);
      }
    }

    this.handleInput(aiKeys, dt);
  }

  // CPU 전용 외형: 로봇 느낌의 각진 디자인
  draw(ctx) {
    const scale  = getScale();
    const r      = this.radius * scale;
    const angle  = Math.atan2(this.dir.y, this.dir.x);
    const c      = this.hitTimer > 0 ? invertColor(this.color) : this.color;

    const main  = `rgb(${c.r},${c.g},${c.b})`;
    const dark  = `rgb(${Math.floor(c.r*0.35)},${Math.floor(c.g*0.35)},${Math.floor(c.b*0.35)})`;
    const light = `rgb(${Math.min(255,c.r+110)},${Math.min(255,c.g+110)},${Math.min(255,c.b+110)})`;
    const glow  = `rgba(${c.r},${c.g},${c.b},0.4)`;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);

    // 바닥 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(r*0.1, r*0.1, r*0.9, r*0.68, 0, 0, Math.PI*2);
    ctx.fill();

    // 하체 (사각 트랙)
    ctx.fillStyle = dark;
    for (const s of [1, -1]) {
      ctx.beginPath();
      ctx.roundRect(-r*0.55, s*r*0.48, r*1.1, r*0.28, r*0.1);
      ctx.fill();
      // 트랙 줄무늬
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.roundRect(-r*0.42 + i*r*0.3, s*r*0.51, r*0.14, r*0.22, r*0.04);
        ctx.fill();
      }
      ctx.fillStyle = dark;
    }

    // 몸통 (육각 장갑)
    ctx.fillStyle = main;
    ctx.beginPath();
    ctx.roundRect(-r*0.62, -r*0.45, r*1.24, r*0.9, r*0.18);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = r * 0.13;
    ctx.stroke();

    // 몸통 패널 라인
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = r * 0.07;
    ctx.beginPath();
    ctx.moveTo(-r*0.15, -r*0.38);
    ctx.lineTo(-r*0.15, r*0.38);
    ctx.stroke();

    // 총기 포탑 (원통형)
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(r*0.12, r*0.3, r*0.26, r*0.2, -0.2, 0, Math.PI*2);
    ctx.fill();

    // 총기 본체
    ctx.fillStyle = '#1e1e1e';
    ctx.beginPath();
    ctx.roundRect(r*0.0, r*0.22, r*1.15, r*0.26, r*0.07);
    ctx.fill();
    ctx.strokeStyle = '#444';
    ctx.lineWidth = r * 0.05;
    ctx.stroke();

    // 총구 플래시 가드
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.rect(r*0.98, r*0.24, r*0.22, r*0.22);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(r*1.19, r*0.35, r*0.06, 0, Math.PI*2);
    ctx.fill();

    // 로봇 머리 (사각형)
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.roundRect(-r*0.38, -r*0.38, r*0.76, r*0.76, r*0.14);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = r * 0.1;
    ctx.stroke();

    // 스캐너 눈 (빨간 LED 두 줄)
    ctx.fillStyle = '#ff2222';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = r * 0.8;
    for (const s of [1, -1]) {
      ctx.beginPath();
      ctx.roundRect(r*0.02, s*r*0.08 - r*0.055, r*0.28, r*0.11, r*0.04);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // 머리 중앙 세로선 (로봇 심볼)
    ctx.strokeStyle = dark;
    ctx.lineWidth = r * 0.07;
    ctx.beginPath();
    ctx.moveTo(-r*0.0, -r*0.32);
    ctx.lineTo(-r*0.0, r*0.32);
    ctx.stroke();

    // AI 글로우 링
    ctx.strokeStyle = glow;
    ctx.lineWidth = r * 0.08;
    ctx.beginPath();
    ctx.arc(0, 0, r*0.92, 0, Math.PI*2);
    ctx.stroke();

    ctx.restore();

    // ── UI (월드 좌표) ─────────────────────────────────────────────
    const barWidth = 10;
    const barHeight = 6;
    const spacing = 3;
    const totalBarWidth = (barWidth * SETTINGS.MAX_HP) + (spacing * (SETTINGS.MAX_HP - 1));
    const startX = this.x - totalBarWidth / 2;
    const startY = this.y - r - 22;

    for (let i = 0; i < SETTINGS.MAX_HP; i++) {
      if (i < this.hp) {
        ctx.fillStyle = main;
        ctx.fillRect(startX + i * (barWidth + spacing), startY, barWidth, barHeight);
      } else {
        ctx.strokeStyle = 'rgba(100,100,100,0.5)';
        ctx.strokeRect(startX + i * (barWidth + spacing), startY, barWidth, barHeight);
      }
    }

    const dashBarY = startY + barHeight + 4;
    ctx.fillStyle = 'rgba(100,100,100,0.5)';
    ctx.fillRect(startX, dashBarY, totalBarWidth, 4);
    ctx.fillStyle = 'yellow';
    ctx.fillRect(startX, dashBarY, totalBarWidth * (1 - this.dashCooldown / SETTINGS.DASH_COOLDOWN), 4);

    if (this.isReloading) {
      const progress = 1 - (this.reloadTimer / SETTINGS.RELOAD_TIME);
      ctx.strokeStyle = 'rgba(255,165,0,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
    }
  }
}

/* =========================================================================
   [메인 게임 루프]
========================================================================= */
function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;

  // 실제 경과 시간(초). 최대 50ms로 제한 — 탭 전환 복귀 시 폭발적 dt 방지
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  if (currentState === GAME_STATE.START) {
    drawStartScreen();
  } else {
    // 배경: 어두운 격자 패턴
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const gridSize = 48;
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    if (currentState === GAME_STATE.PLAYING) {
      obstacles.forEach(obs => obs.update(canvas.width, canvas.height));
      healingZones.forEach(hz => hz.update(canvas.width, canvas.height, dt));

      [p1, p2].forEach(p => {
        let isHealing = false;
        healingZones.forEach(hz => {
          const dx = p.x - hz.x; const dy = p.y - hz.y;
          if (Math.hypot(dx, dy) < hz.radius + (p.radius * getScale())) {
            isHealing = true;
          }
        });

        if (isHealing && p.hp < SETTINGS.MAX_HP) {
          p.healTimer += dt * 60;
          if (p.healTimer >= 120) {
            p.hp++;
            p.healTimer = 0;
            for (let i = 0; i < 8; i++) particles.push(new Particle(p.x, p.y, { r: 0, g: 255, b: 100 }));
          }
        } else {
          p.healTimer = 0;
        }
      });

      [p1, p2].forEach(p => {
        const oldX = p.x; const oldY = p.y;
        if (isSinglePlayer && p === p2) {
          p2.updateAI(p1, bullets, obstacles, canvas.width, canvas.height, dt);
        } else {
          p.handleInput(keys, dt);
        }
        p.update(canvas.width, canvas.height, dt);

        obstacles.forEach(obs => {
          if (isCollidingRect(p, obs)) {
            const dtF = dt * 60;
            let dummyX = { x: p.x - p.vx * dtF, y: p.y, radius: p.radius };
            if (!isCollidingRect(dummyX, obs)) { p.x -= p.vx * dtF; p.vx = 0; }
            else {
              let dummyY = { x: p.x, y: p.y - p.vy * dtF, radius: p.radius };
              if (!isCollidingRect(dummyY, obs)) { p.y -= p.vy * dtF; p.vy = 0; }
              else { p.x = oldX; p.y = oldY; p.vx = 0; p.vy = 0; }
            }
          }
        });
      });

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update(canvas.width, canvas.height, dt);
        if (p.life <= 0) particles.splice(i, 1);
      }

      if (keys[p1.controls.shoot]) p1.shoot(bullets);
      if (!isSinglePlayer && keys[p2.controls.shoot]) p2.shoot(bullets);

      if (keys[p1.controls.reload]) p1.startReload();
      if (!isSinglePlayer && keys[p2.controls.reload]) p2.startReload();

      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.update(canvas.width, canvas.height, dt);

        if (!b.isAlive()) {
          bullets.splice(i, 1);
          continue;
        }

        let hitObstacle = false;
        for (let j = 0; j < obstacles.length; j++) {
          const obs = obstacles[j];
          if (isCollidingRect(b, obs)) {
            for (let k = 0; k < 6; k++) particles.push(new Particle(b.x, b.y, b.color));
            obs.hp--;
            if (obs.hp <= 0) {
              for (let k = 0; k < 15; k++) particles.push(new Particle(obs.x + obs.width / 2, obs.y + obs.height / 2, obs.color));
              obstacles.splice(j, 1);
            }
            bullets.splice(i, 1);
            hitObstacle = true;
            break;
          }
        }
        if (hitObstacle) continue;

        for (const player of [p1, p2]) {
          if (b.owner === player) continue;
          if (player.invTimer > 0) continue;

          if (isColliding(b, player)) {
            const scale = getScale();
            player.hp--;
            player.vx += b.vx * 0.4 * scale;
            player.vy += b.vy * 0.4 * scale;
            player.hitTimer = 30;
            player.stunTimer = 30;
            player.invTimer = 20;

            screenShake.intensity = 10;

            for (let k = 0; k < 12; k++) particles.push(new Particle(b.x, b.y, b.color));
            bullets.splice(i, 1);
            break;
          }
        }
      }

      if (p1.hp <= 0 || p2.hp <= 0) {
        winner = p1.hp <= 0 ? "P2" : "P1";
        if (winner === "P1") scores.p1++;
        else scores.p2++;
        currentState = GAME_STATE.GAMEOVER;
      }
    }

    ctx.save();
    if (screenShake.intensity > 0) {
      ctx.translate(
        (Math.random() - 0.5) * screenShake.intensity,
        (Math.random() - 0.5) * screenShake.intensity
      );
      screenShake.intensity *= 0.7;
      if (screenShake.intensity < 0.5) screenShake.intensity = 0;
    }
    healingZones.forEach(hz => hz.draw(ctx));
    obstacles.forEach(obs => obs.draw(ctx));
    p1.draw(ctx);
    p2.draw(ctx);
    particles.forEach(p => p.draw(ctx));
    bullets.forEach(b => b.draw(ctx));
    ctx.restore();
    drawUI();

    if (currentState === GAME_STATE.GAMEOVER) {
      drawGameOver();
    }
  }

  requestAnimationFrame(gameLoop);
}

/* =========================================================================
   [이벤트 리스너 등록]
========================================================================= */

document.getElementById('btn-1p').addEventListener('click', () => {
  isSinglePlayer = true;
  p2 = new CPUPlayer(canvas.width * 0.9, canvas.height * 0.4, { r: 255, g: 0, b: 0 });
  document.getElementById('startMenu').classList.add('hidden');
  currentState = GAME_STATE.PLAYING;
});

document.getElementById('btn-2p').addEventListener('click', () => {
  isSinglePlayer = false;
  p2 = new Player(canvas.width * 0.9, canvas.height * 0.4, { r: 255, g: 0, b: 0 }, {
    up: 'i', down: 'k', left: 'j', right: 'l', shoot: ';', reload: 'p', dash: 'enter'
  });
  document.getElementById('startMenu').classList.add('hidden');
  currentState = GAME_STATE.PLAYING;
});

window.addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  keys[key] = true;

  if (currentState === GAME_STATE.GAMEOVER && key === 'r') {
    resetGame();
    document.getElementById('startMenu').classList.remove('hidden');
  }
});

window.addEventListener('keyup', e => {
  const key = e.key.toLowerCase();
  keys[key] = false;
});

requestAnimationFrame(gameLoop);
