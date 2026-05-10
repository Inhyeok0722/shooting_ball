/* =========================================================================
   [전역 변수 및 캔버스 초기화]
   게임의 전반적인 상태와 환경 설정을 관리합니다.
========================================================================= */

// 게임 상태 정의
const GAME_STATE = {
  START: 'START',
  PLAYING: 'PLAYING',
  GAMEOVER: 'GAMEOVER'
};
let currentState = GAME_STATE.START; // 현재 게임 상태
let winner = null;                    // 승리자 정보 저장
let isSinglePlayer = false;           // 1인 플레이 모드 여부

// 캔버스 엘리먼트 및 렌더링 컨텍스트 설정
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 게임 밸런스 및 시스템 설정값 (상수화)
const SETTINGS = {
  PLAYER_SPEED: 6,        // 최대 이동 속도 제한
  PLAYER_ACCEL: 0.5,      // 이동 시 가속되는 정도
  PLAYER_FRICTION: 0.92,  // 매 프레임 속도가 줄어드는 비율 (관성 효과)
  BULLET_SPEED: 24,       // 발사된 총알의 속도
  SHOOT_COOLDOWN: 15,     // 다음 발사까지 필요한 프레임 간격
  RELOAD_SPEED_MULTIPLIER: 0.5, // 재장전 시 속도 배율 (50%)
  MAX_HP: 5,              // 플레이어 최대 체력
  MAX_AMMO: 10,           // 한 탄창에 들어가는 탄약 수
  RELOAD_TIME: 150,       // 재장전 완료까지 걸리는 프레임 (약 2.5초)
  NORMAL_FONT_COLOR: 'rgba(0, 0, 0, 0.6)', // 기본 UI 텍스트 투명도 및 색상
  DASH_COOLDOWN: 180,     // 대시 쿨타임 (약 3초)
  DASH_SPEED_MULTIPLIER: 3, // 대시 시 속도 배율
  DASH_DURATION: 12       // 대시 지속 프레임
};

// FPS 고정
const TARGET_FPS = 61; // 목적은 60fps이나, 60으로 설정했을 때 잔렉이 많이 발생하는 것으로 보여 여유를 둠.
const FPS_INTERVAL = 1000 / TARGET_FPS;
let lastTime = 0;

/* =========================================================================
   [반응형 캔버스 설정]
========================================================================= */
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // 크기가 바뀔 때마다 플레이어 위치가 화면 밖으로 나가지 않게 보정하고 싶다면 
  // 여기에 위치 재계산 로직을 추가할 수 있습니다.
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // 초기 실행

// 캔버스 사이즈 설정
const BASE_WIDTH = 1920;
const BASE_HEIGHT = 1080;

// 현재 화면이 기준 사이즈 대비 얼마나 커졌는지/작아졌는지 계산하는 함수
function getScale() {
  return Math.min(canvas.width / BASE_WIDTH, canvas.height / BASE_HEIGHT);
}



/* =========================================================================
   [화면 렌더링 함수 모음]
   게임 화면의 각 상태에 따라 시각적인 요소를 그리는 함수들입니다.
========================================================================= */

// 게임 시작 대기 화면
function drawStartScreen() {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// 게임 종료 화면 (승리자 표시 및 재시작 안내)
function drawGameOver() {
  ctx.fillStyle = SETTINGS.NORMAL_FONT_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "white";
  ctx.font = "60px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`${winner} WIN!`, canvas.width / 2, canvas.height / 2);

  ctx.font = "25px Arial";
  ctx.fillText("Press R to Restart", canvas.width / 2, canvas.height / 2 + 50);
}

// 상단 정보 창 (조작법, 탄약 상태, 재장전 안내)
function drawUI() {
  ctx.fillStyle = SETTINGS.NORMAL_FONT_COLOR;

  // Player 1 UI (좌측 상단)
  ctx.textAlign = "left";
  ctx.font = "bold 18px Arial";
  ctx.fillText("P1 (Blue)", 20, 30);
  ctx.font = "14px Arial";
  ctx.fillText("Move: W, A, S, D | Shoot: F | Reload: R | Dash : Shift", 20, 55);

  ctx.font = "bold 16px Arial";
  // 재장전 중일 때는 주황색으로 상태 표시
  ctx.fillStyle = p1.isReloading ? "orange" : SETTINGS.NORMAL_FONT_COLOR;
  ctx.fillText(`Ammo: ${p1.isReloading ? "RELOADING..." : p1.ammo + " / " + SETTINGS.MAX_AMMO}`, 20, 80);

  // Player 2 UI (우측 상단)
  ctx.textAlign = "right";
  ctx.fillStyle = SETTINGS.NORMAL_FONT_COLOR;
  ctx.font = "bold 18px Arial";
  ctx.fillText(isSinglePlayer ? "P2 (CPU)" : "P2 (Red)", canvas.width - 20, 30);
  ctx.font = "14px Arial";
  ctx.fillText(isSinglePlayer ? "CPU Managed" : "Move: I, J, K, L | Shoot: ; | Reload: P | Dash : Enter", canvas.width - 20, 55);

  ctx.font = "bold 16px Arial";
  ctx.fillStyle = p2.isReloading ? "orange" : SETTINGS.NORMAL_FONT_COLOR;
  ctx.fillText(`Ammo: ${p2.isReloading ? "RELOADING..." : p2.ammo + " / " + SETTINGS.MAX_AMMO}`, canvas.width - 20, 80);
}

// 게임 재시작 시 플레이어 및 총알 상태 초기화
function resetGame() {
  p1.x = canvas.width * 0.1; p1.y = canvas.height * 0.6; // 화면 왼쪽에서 10% 지점, 밑에서 40% 지점
  p1.vx = 0; p1.vy = 0;
  p1.hp = SETTINGS.MAX_HP; p1.ammo = SETTINGS.MAX_AMMO; p1.isReloading = false;
  p1.dashCooldown = 0; p1.dashTimer = 0;
  p1.stunTimer = 0; p1.healTimer = 0;

  p2.x = canvas.width * 0.9; p2.y = canvas.height * 0.4; // 화면 오른쪽에서 10% 지점, 위에서 40% 지점
  p2.vx = 0; p2.vy = 0;
  p2.hp = SETTINGS.MAX_HP; p2.ammo = SETTINGS.MAX_AMMO; p2.isReloading = false;
  p2.dashCooldown = 0; p2.dashTimer = 0;
  p2.stunTimer = 0; p2.healTimer = 0;

  bullets.length = 0; // 화면상의 모든 총알 제거
  particles.length = 0; // 파티클 초기화
  if (typeof initMapElements === 'function') initMapElements(); // 맵 요소 초기화
  currentState = GAME_STATE.START;
  winner = null;
}

/* =========================================================================
   [유틸리티 함수 모음]
   계산 및 시각 효과를 돕는 보조 함수들입니다.
========================================================================= */

// 두 원형 객체 사이의 거리를 계산하여 충돌 여부 확인
function isColliding(a, b) {
  const scale = getScale(); // 현재 화면 스케일 가져오기
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy) < ((a.radius * scale) + (b.radius * scale));
}

// 원형 객체(플레이어/총알)와 직사각형 객체(장애물) 사이의 충돌 여부 확인
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
  const distance = Math.sqrt((distX * distX) + (distY * distY));

  return distance <= scaledRadius;
}

// 피격 시 플레이어의 색상을 순간적으로 반전시키는 기능
function invertColor(c) {
  return { r: 255 - c.r, g: 255 - c.g, b: 255 - c.b };
}

/* =========================================================================
   [클래스 모음]
   게임 내 모든 물리 객체의 설계도입니다.
========================================================================= */

// 모든 게임 객체의 기본이 되는 클래스
class GameObject {
  constructor(x, y, color) {
    this.x = x; this.y = y;           // 위치 좌표
    this.vx = 0; this.vy = 0;         // 현재 속도 (Vector X, Y)
    this.accel = SETTINGS.PLAYER_ACCEL;
    this.friction = SETTINGS.PLAYER_FRICTION;
    this.maxSpeed = SETTINGS.PLAYER_SPEED;
    this.color = color;
    this.radius = 15;
    this.dir = { x: 0, y: -1 };       // 현재 바라보고 있는 방향 (발사 방향)
  }

  // 매 프레임 위치 및 속도 업데이트
  update(canvasWidth, canvasHeight) {
    // 마찰력 적용
    this.vx *= this.friction;
    this.vy *= this.friction;

    // 미세한 속도는 0으로 처리하여 떨림 방지
    if (Math.abs(this.vx) < 0.01) this.vx = 0;
    if (Math.abs(this.vy) < 0.01) this.vy = 0;

    // 위치 갱신
    this.x += this.vx;
    this.y += this.vy;

    this.checkBoundary(canvasWidth, canvasHeight);
  }

  // 화면 밖으로 나가지 못하게 벽과 충돌 처리
  checkBoundary(width, height) {
    if (this.x < this.radius) { this.x = this.radius; this.vx *= -1; }
    else if (this.x > width - this.radius) { this.x = width - this.radius; this.vx *= -1; }

    if (this.y < this.radius) { this.y = this.radius; this.vy *= -1; }
    else if (this.y > height - this.radius) { this.y = height - this.radius; this.vy *= -1; }
  }

  // 화면에 원 형태로 객체 그리기
  draw(ctx) {
    const scale = getScale();
    let c = this.hitTimer > 0 ? invertColor(this.color) : this.color;

    ctx.fillStyle = `rgb(${c.r}, ${c.g}, ${c.b})`;
    ctx.beginPath();
    // 반지름(radius)에 배율을 적용하여 모니터 크기에 따라 캐릭터 크기가 조절되게 합니다.
    ctx.arc(this.x, this.y, this.radius * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
  }
}

// 플레이어 클래스 (조작 및 전투 로직 포함)
class Player extends GameObject {
  constructor(x, y, color, controls) {
    super(x, y, color);
    this.controls = controls;         // 지정된 키 매핑
    this.hp = SETTINGS.MAX_HP;
    this.cooldown = 0;                // 발사 대기 시간 타이머
    this.hitTimer = 0;                // 피격 이펙트 타이머

    // 탄창 시스템 관련 속성
    this.ammo = SETTINGS.MAX_AMMO;
    this.reloadTimer = 0;
    this.isReloading = false;

    // 대시 시스템 관련 속성
    this.dashCooldown = 0;
    this.dashTimer = 0;

    // 전술 시스템 관련 속성
    this.stunTimer = 0;
    this.healTimer = 0;
  }

  // 키 입력에 따른 가속도 및 방향 설정
  handleInput(keys) {
    let dx = 0; let dy = 0;
    const scale = getScale(); // 현재 화면 배율 가져오기

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
      return; // 대시 중에는 일반 이동 무시
    }

    // 재장전 중이면 속도를 절반으로 줄임
    // 2026.04.29, 속도를 반응형으로 변경함
    let accelMult = this.isReloading ? SETTINGS.RELOAD_SPEED_MULTIPLIER : 1;
    let speedMult = this.isReloading ? SETTINGS.RELOAD_SPEED_MULTIPLIER : 1;

    // 피격 경직 상태면 속도 대폭 감소 (30%)
    if (this.stunTimer > 0) {
      accelMult *= 0.3;
      speedMult *= 0.3;
    }

    const currentAccel = this.accel * accelMult * scale;
    const currentMaxSpeed = this.maxSpeed * speedMult * scale;

    if (keys[this.controls.up]) { this.vy -= currentAccel; dy -= 1; }
    if (keys[this.controls.down]) { this.vy += currentAccel; dy += 1; }
    if (keys[this.controls.left]) { this.vx -= currentAccel; dx -= 1; }
    if (keys[this.controls.right]) { this.vx += currentAccel; dx += 1; }

    //이동 중일 때만 총구 방향(dir)을 갱신
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      this.dir = { x: dx / len, y: dy / len };
    }

    // 속도 제한(최대 속도 이상 가속 방지)
    this.vx = Math.max(-currentMaxSpeed, Math.min(currentMaxSpeed, this.vx));
    this.vy = Math.max(-currentMaxSpeed, Math.min(currentMaxSpeed, this.vy));
  }

  // 총알 생성 및 탄약 차감 로직
  shoot(bullets) {
    // 2026.04.29, 속도를 반응형으로 변경함
    const scale = getScale() // 현재 화면 배율 가져오기
    if (this.cooldown > 0 || this.isReloading) return; // 쿨타임 중이거나 재장전 중이면 발사 불가

    if (this.ammo > 0) {
      this.ammo--;
      this.cooldown = SETTINGS.SHOOT_COOLDOWN;

      bullets.push(new Bullet(
        this.x, this.y,
        this.dir.x * SETTINGS.BULLET_SPEED * scale,
        this.dir.y * SETTINGS.BULLET_SPEED * scale,
        this.color, this
      ));

      // 마지막 탄환 발사 시 자동 재장전 시작
      if (this.ammo === 0) {
        this.startReload();
      }
    }
  }

  // 재장전 프로세스 시작
  startReload() {
    if (!this.isReloading && this.ammo < SETTINGS.MAX_AMMO) {
      this.isReloading = true;
      this.reloadTimer = SETTINGS.RELOAD_TIME;
    }
  }

  // 플레이어 전용 업데이트 (물리 + 각종 타이머)
  update(canvasWidth, canvasHeight) {
    super.update(canvasWidth, canvasHeight);

    if (this.cooldown > 0) this.cooldown--;
    if (this.hitTimer > 0) this.hitTimer--;
    if (this.dashCooldown > 0) this.dashCooldown--;
    if (this.dashTimer > 0) {
      this.dashTimer--;
      this.hitTimer = 2; // 대시 중 시각적 무적/잔상 효과
    }
    if (this.stunTimer > 0) this.stunTimer--;

    // 재장전 시간 카운트다운
    if (this.isReloading) {
      this.reloadTimer--;
      if (this.reloadTimer <= 0) {
        this.ammo = SETTINGS.MAX_AMMO;
        this.isReloading = false;
      }
    }
  }

  // 플레이어 본체와 상단 체력바 렌더링
  draw(ctx) {
    super.draw(ctx);

    const barWidth = 10;
    const barHeight = 6;
    const spacing = 3;
    const totalBarWidth = (barWidth * SETTINGS.MAX_HP) + (spacing * (SETTINGS.MAX_HP - 1));

    let startX = this.x - (totalBarWidth / 2);
    let startY = this.y - this.radius - 20;

    // 체력 칸 그리기
    for (let i = 0; i < SETTINGS.MAX_HP; i++) {
      if (i < this.hp) {
        ctx.fillStyle = `rgb(${this.color.r}, ${this.color.g}, ${this.color.b})`;
        ctx.fillRect(startX + i * (barWidth + spacing), startY, barWidth, barHeight);
      } else {
        ctx.strokeStyle = "rgba(100, 100, 100, 0.5)";
        ctx.strokeRect(startX + i * (barWidth + spacing), startY, barWidth, barHeight);
      }
    }

    // 대시 쿨타임 바 그리기
    let dashBarY = startY + barHeight + 4;
    ctx.fillStyle = "rgba(100, 100, 100, 0.5)";
    ctx.fillRect(startX, dashBarY, totalBarWidth, 4);
    let dashRatio = 1 - (this.dashCooldown / SETTINGS.DASH_COOLDOWN);
    ctx.fillStyle = "yellow";
    ctx.fillRect(startX, dashBarY, totalBarWidth * dashRatio, 4);

    // 조준기(삼각형) 그리기
    const triangleSize = 8;     // 삼각형의 크기 (높이)
    const offsetFromPlayer = this.radius + 10; // 플레이어 중심에서 삼각형까지의 거리

    // 플레이어의 고유 색상을 반투명하게 사용
    ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0.7)`;

    // 현재 바라보는 방향(this.dir)의 라디안 각도 계산
    const angle = Math.atan2(this.dir.y, this.dir.x);

    ctx.save(); // 현재 캔버스 상태(회전, 평행이동 등) 저장

    // 캔버스의 원점을 플레이어의 중심(this.x, this.y)으로 평행 이동
    ctx.translate(this.x, this.y);
    // 계산된 각도만큼 캔버스 자체를 회전
    ctx.rotate(angle);

    // 이제 캔버스가 플레이어 중심으로 회전했으므로, 
    // 정면(오른쪽 방향)으로 offsetFromPlayer 만큼 떨어진 곳에 삼각형을 그리면 됩니다.
    ctx.beginPath();
    // 삼각형의 정점 (조준 방향 끝)
    ctx.moveTo(offsetFromPlayer + triangleSize, 0);
    // 왼쪽 아래 점
    ctx.lineTo(offsetFromPlayer, -triangleSize / 2);
    // 오른쪽 아래 점
    ctx.lineTo(offsetFromPlayer, triangleSize / 2);
    ctx.fill(); // 채우기
    ctx.closePath();

    ctx.restore(); // 저장했던 캔버스 상태로 복구 (다른 그리기 작업에 영향 주지 않기 위해)

  }
}

// 총알 클래스
class Bullet extends GameObject {
  constructor(x, y, vx, vy, color, owner) {
    super(x, y, color);
    this.vx = vx; this.vy = vy;
    this.radius = 5;
    this.life = 100;    // 총알이 사라지기 전까지 유지되는 시간(프레임)
    this.friction = 1;  // 총알은 감속되지 않음
    this.owner = owner; // 총알을 쏜 주인 정보 (자폭 방지용)
  }

  update(canvasWidth, canvasHeight) {
    super.update(canvasWidth, canvasHeight);
    this.life--; // 매 프레임 수명 감소
  }

  isAlive() {
    return this.life > 0;
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
    ctx.globalAlpha = Math.max(0.2, this.hp / this.maxHp); // 체력에 따라 투명해짐
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // 남은 체력 게이지 (벽 중앙)
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

  update(canvasWidth, canvasHeight) {
    this.x = canvasWidth * this.xRatio;
    this.y = canvasHeight * this.yRatio;
    const scale = getScale();
    this.radius = 100 * scale; // 스케일 반영된 고정 크기 (화면 비율로 약 100px)
    this.pulse += 0.05;
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

    // 중앙에 + 표시
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

  update(canvasWidth, canvasHeight) {
    super.update(canvasWidth, canvasHeight);
    this.life--;
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
const keys = {};     // 현재 눌려있는 키 상태를 저장하는 객체
const bullets = [];   // 화면에 존재하는 모든 총알 인스턴스 저장 배열
const particles = [];
const obstacles = [];
const healingZones = [];

// 장애물 및 거점 배치
function initMapElements() {
  obstacles.length = 0;
  healingZones.length = 0;
  // 중앙 힐링존
  healingZones.push(new HealingZone(0.5, 0.5));
  // 좌우 블록 (힐링존 보호용 벽)
  obstacles.push(new Obstacle(0.35, 0.4, 0.03, 0.2, "gray", 15));
  obstacles.push(new Obstacle(0.62, 0.4, 0.03, 0.2, "gray", 15));
}
initMapElements();

// Player 1 설정 (파란색, WASD & F, 수동재장전 R, 대시 Shift)
const p1 = new Player(canvas.width * 0.1, canvas.height * 0.6, { r: 0, g: 0, b: 255 }, {
  up: 'w', down: 's', left: 'a', right: 'd', shoot: 'f', reload: 'r', dash: 'shift'
});

// Player 2 설정 (빨간색, IJKL & ;, 수동재장전 P, 대시 Enter)
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

  updateAI(target, bullets, obstacles, canvasWidth, canvasHeight) {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);

    // 1. 타겟 조준
    if (dist > 0) {
      this.dir = { x: dx / dist, y: dy / dist };
    }

    const aiKeys = {};

    // 2. 위험 감지 (날아오는 총알 회피)
    if (this.dashCooldown <= 0) {
      for (const b of bullets) {
        if (b.owner === this) continue;
        const bdx = this.x - b.x;
        const bdy = this.y - b.y;
        const bdist = Math.hypot(bdx, bdy);
        if (bdist < 150) {
          // 총알이 나를 향해 오는지 대략적으로 확인
          const dot = (b.vx * bdx + b.vy * bdy) / bdist;
          if (dot > 15) { // 내 쪽으로 빠르게 다가오면
            aiKeys[this.controls.dash] = true;
            break;
          }
        }
      }
    }

    // 3. 전술적 이동 목표 설정
    let targetX = target.x;
    let targetY = target.y;
    let moveMode = 'CHASE';

    if (this.hp <= 2) {
      // 체력이 낮으면 힐링존으로
      moveMode = 'HEAL';
      targetX = canvasWidth * 0.5;
      targetY = canvasHeight * 0.5;
    } else if (this.ammo === 0) {
      // 탄약이 없으면 가장 가까운 장애물 뒤로 숨기
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
        // 타겟의 반대 방향으로 장애물 너머에 위치
        const hideDirX = obsCX - target.x;
        const hideDirY = obsCY - target.y;
        const hideLen = Math.hypot(hideDirX, hideDirY);
        targetX = obsCX + (hideDirX / hideLen) * 50;
        targetY = obsCY + (hideDirY / hideLen) * 50;
        this.startReload();
      }
    }

    // 4. 실제 이동 제어
    const tdx = targetX - this.x;
    const tdy = targetY - this.y;
    const tdist = Math.hypot(tdx, tdy);

    if (moveMode === 'CHASE') {
      if (tdist > 450) {
        // 접근
        if (tdx > 20) aiKeys[this.controls.right] = true;
        if (tdx < -20) aiKeys[this.controls.left] = true;
        if (tdy > 20) aiKeys[this.controls.down] = true;
        if (tdy < -20) aiKeys[this.controls.up] = true;
      } else if (tdist < 250) {
        // 후퇴
        if (tdx > 0) aiKeys[this.controls.left] = true;
        if (tdx < 0) aiKeys[this.controls.right] = true;
        if (tdy > 0) aiKeys[this.controls.up] = true;
        if (tdy < 0) aiKeys[this.controls.down] = true;
      } else {
        // 횡이동 (플레이어 주변 맴돌기)
        if (Math.sin(Date.now() / 400) > 0) {
          aiKeys[this.controls.up] = true;
        } else {
          aiKeys[this.controls.down] = true;
        }
      }
    } else {
      // HEAL 또는 HIDE 상태일 때는 목적지로 직진
      if (tdx > 10) aiKeys[this.controls.right] = true;
      if (tdx < -10) aiKeys[this.controls.left] = true;
      if (tdy > 10) aiKeys[this.controls.down] = true;
      if (tdy < -10) aiKeys[this.controls.up] = true;
    }

    // 5. 사격 결정
    if (moveMode === 'CHASE' && dist < 700 && !this.isReloading) {
      // 조준 보정 (약간의 오차 고려 가능하나 여기선 정확히)
      if (Math.random() < 0.06) {
        this.shoot(bullets);
      }
    }

    this.handleInput(aiKeys);
  }
}



/* =========================================================================
   [메인 게임 루프]
   매 초 60회 가량 실행되며 물리 연산과 화면 그리기를 반복합니다.
========================================================================= */
function gameLoop(timestamp) {

  // 처음 실행될 때 timestamp가 없다면 초기화
  if (!lastTime) lastTime = timestamp;

  // 현재 시간과 마지막 실행 시간의 차이 계산
  const elapsed = timestamp - lastTime;

  // 경과 시간이 16.67ms (60fps 기준)를 넘었을 때만 게임 로직 실행
  if (elapsed > FPS_INTERVAL) {
    // 다음 프레임 계산이 밀리지 않도록 초과된 자투리 시간을 보정 (매우 중요!)
    lastTime = timestamp - (elapsed % FPS_INTERVAL);

    // 1. 시작 화면 처리
    if (currentState === GAME_STATE.START) {
      drawStartScreen();
    } else {
      // 2. 화면 지우기 (잔상 제거)
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 3. 게임 플레이 로직
      if (currentState === GAME_STATE.PLAYING) {
        // 맵 요소 업데이트
        obstacles.forEach(obs => obs.update(canvas.width, canvas.height));
        healingZones.forEach(hz => hz.update(canvas.width, canvas.height));

        // 회복 거점 로직
        [p1, p2].forEach(p => {
          let isHealing = false;
          healingZones.forEach(hz => {
            const dx = p.x - hz.x; const dy = p.y - hz.y;
            if (Math.hypot(dx, dy) < hz.radius + (p.radius * getScale())) {
              isHealing = true;
            }
          });

          if (isHealing && p.hp < SETTINGS.MAX_HP) {
            p.healTimer++;
            if (p.healTimer >= 120) { // 약 2초 머물면 1 회복
              p.hp++;
              p.healTimer = 0;
              // 힐링 이펙트
              for (let i = 0; i < 8; i++) particles.push(new Particle(p.x, p.y, { r: 0, g: 255, b: 100 }));
            }
          } else {
            p.healTimer = 0; // 벗어나면 초기화
          }
        });

        // 플레이어 이동 업데이트 및 장애물 충돌 처리
        [p1, p2].forEach(p => {
          let oldX = p.x; let oldY = p.y;
          if (isSinglePlayer && p === p2) {
            p2.updateAI(p1, bullets, obstacles, canvas.width, canvas.height);
          } else {
            p.handleInput(keys);
          }
          p.update(canvas.width, canvas.height);

          obstacles.forEach(obs => {
            if (isCollidingRect(p, obs)) {
              // 단순화된 충돌 밀어내기 (X축 먼저)
              let dummyX = { x: p.x - p.vx, y: p.y, radius: p.radius };
              if (!isCollidingRect(dummyX, obs)) { p.x -= p.vx; p.vx = 0; }
              else {
                let dummyY = { x: p.x, y: p.y - p.vy, radius: p.radius };
                if (!isCollidingRect(dummyY, obs)) { p.y -= p.vy; p.vy = 0; }
                else { p.x = oldX; p.y = oldY; p.vx = 0; p.vy = 0; }
              }
            }
          });
        });

        // 파티클 업데이트
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.update(canvas.width, canvas.height);
          if (p.life <= 0) particles.splice(i, 1);
        }

        // 공격 처리 (키를 누르고 있으면 shoot 메서드 반복 호출)
        if (keys[p1.controls.shoot]) p1.shoot(bullets);
        if (!isSinglePlayer && keys[p2.controls.shoot]) p2.shoot(bullets);

        // 수동 재장전 입력 처리
        if (keys[p1.controls.reload]) p1.startReload();
        if (!isSinglePlayer && keys[p2.controls.reload]) p2.startReload();

        // 총알 물리 업데이트 및 충돌 검사
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i];
          b.update(canvas.width, canvas.height);

          // 수명이 다한 총알 제거
          if (!b.isAlive()) {
            bullets.splice(i, 1);
            continue;
          }

          let hitObstacle = false;
          // 장애물 충돌 판정
          for (let j = 0; j < obstacles.length; j++) {
            const obs = obstacles[j];
            if (isCollidingRect(b, obs)) {
              // 파티클 생성
              for (let k = 0; k < 6; k++) particles.push(new Particle(b.x, b.y, b.color));

              obs.hp--; // 체력 감소
              if (obs.hp <= 0) {
                // 파괴 이펙트
                for (let k = 0; k < 15; k++) particles.push(new Particle(obs.x + obs.width / 2, obs.y + obs.height / 2, obs.color));
                obstacles.splice(j, 1);
              }

              bullets.splice(i, 1);
              hitObstacle = true;
              break;
            }
          }
          if (hitObstacle) continue;

          // 상대 플레이어와의 충돌 판정
          for (const player of [p1, p2]) {
            if (b.owner === player) continue; // 자신이 쏜 총알은 무시

            if (isColliding(b, player)) {
              const scale = getScale()    // 현재 화면 배율 가져오기
              player.hp--;                // 체력 감소
              player.vx += b.vx * 0.4 * scale;    // 피격 시 넉백 효과 적용
              player.vy += b.vy * 0.4 * scale;
              player.hitTimer = 30;       // 피격 이펙트 지속
              player.stunTimer = 30;      // 명중 시 0.5초 경직 (이속 대폭 감소)

              // 파티클 생성
              for (let k = 0; k < 12; k++) particles.push(new Particle(b.x, b.y, b.color));

              bullets.splice(i, 1);       // 충돌한 총알 제거
              break;
            }
          }
        }

        // 승패 체크 (누군가의 HP가 0 이하가 되면 종료)
        if (p1.hp <= 0 || p2.hp <= 0) {
          winner = p1.hp <= 0 ? "P2" : "P1";
          currentState = GAME_STATE.GAMEOVER;
        }
      }

      // 4. 객체 렌더링 순서 (배경/장애물 -> 플레이어 -> 파티클 -> 총알 -> UI)
      healingZones.forEach(hz => hz.draw(ctx));
      obstacles.forEach(obs => obs.draw(ctx));
      p1.draw(ctx);
      p2.draw(ctx);
      particles.forEach(p => p.draw(ctx));
      bullets.forEach(b => b.draw(ctx));
      drawUI();

      // 5. 게임 종료 화면 오버레이
      if (currentState === GAME_STATE.GAMEOVER) {
        drawGameOver();
      }
    }
  }

  // 다음 프레임 요청은 항상 수행
  requestAnimationFrame(gameLoop);
}

/* =========================================================================
   [이벤트 리스너 등록]
   키보드 입력을 감지하고 게임 상태를 전환합니다.
========================================================================= */

// UI 버튼 이벤트 등록
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

// 키를 눌렀을 때 실행
window.addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  keys[key] = true;

  // 종료 화면에서 R을 누르면 게임 리셋 (시작 화면으로 이동)
  if (currentState === GAME_STATE.GAMEOVER && key === 'r') {
    resetGame();
    document.getElementById('startMenu').classList.remove('hidden');
  }
});

// 키에서 손을 뗐을 때 실행
window.addEventListener('keyup', e => {
  const key = e.key.toLowerCase();
  keys[key] = false;
});

// 모든 준비가 끝나면 루프 시작
requestAnimationFrame(gameLoop);