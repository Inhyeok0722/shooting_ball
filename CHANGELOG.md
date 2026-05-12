# script.js 변경 이력

---

## v1.1 — 버그 수정 및 게임플레이 개선

### 버그 수정

#### 총알이 벽에서 반사되는 문제
- `Bullet` 클래스가 부모 클래스(`GameObject`)의 `checkBoundary()`를 그대로 상속받아 벽에 닿으면 속도가 반전(반사)되고 있었음
- `Bullet` 클래스에 `checkBoundary()`를 오버라이드하여 벽에 닿으면 `this.life = 0`으로 즉시 소멸하도록 수정

```js
// 수정 전: 부모 클래스 동작 (반사)
// 수정 후
checkBoundary(width, height) {
  if (this.x - this.radius < 0 || this.x + this.radius > width ||
      this.y - this.radius < 0 || this.y + this.radius > height) {
    this.life = 0;
  }
}
```

#### `Player.draw()`에서 `scale is not defined` 오류
- `scale` 변수가 부모 클래스 `GameObject.draw()` 내부의 지역변수로만 존재했음
- 자식 클래스 `Player.draw()`에서는 접근 불가 → 매 프레임 `ReferenceError` 발생 → 게임 루프 중단
- `Player.draw()` 상단에 `const scale = getScale();` 추가하여 해결

---

### 신규 기능

#### 피격 무적 프레임 (`invTimer`)
- 기존에는 피격 직후 연속으로 데미지를 받을 수 있었음
- `Player`에 `invTimer` 속성 추가. 피격 시 20프레임(약 0.33초) 동안 피해 면역

#### 재장전 진행 아크
- 재장전 중 플레이어 주변에 주황색 원호(arc)로 진행률 표시
- 기존에는 UI 텍스트(`RELOADING...`)로만 확인 가능했음

#### 화면 흔들림 (Screen Shake)
- 피격 시 `screenShake.intensity = 10`으로 설정
- 매 프레임 `ctx.translate()`로 랜덤 오프셋 적용, 이후 `intensity *= 0.7`로 감쇠
- `ctx.save()` / `ctx.restore()`로 감싸 UI(`drawUI`)는 흔들리지 않게 처리

#### 라운드 간 점수 유지
- `scores = { p1: 0, p2: 0 }` 전역 변수 추가
- 게임 종료 시 승자 점수 증가. R키로 리셋해도 점수는 유지됨
- 상단 중앙 UI와 게임오버 화면에 점수 표시

#### UI 텍스트 스케일링
- 기존 `drawUI()`의 폰트 크기가 고정값(`18px`, `14px` 등)이어서 화면 크기에 따라 너무 크거나 작았음
- 모든 폰트 크기에 `getScale()` 적용. 최소 배율 `0.6`으로 고정하여 소형 화면에서도 가독성 유지

---

## v1.2 — Delta Time 기반 물리 연산

### 배경

기존 구조의 문제:
- `TARGET_FPS = 61` 캡 방식을 사용했으나 실제 모니터 주사율에 따라 물리 속도가 달라짐
  - 30Hz 모니터: 게임이 절반 속도로 동작
  - 144Hz 모니터: 게임이 2.4배 속도로 동작
- 마찰력 `vx *= 0.92`는 프레임마다 적용되므로 fps가 다르면 감속 곡선 자체가 변함

### 핵심 변경: `dt` 및 `dtF` 도입

```js
// gameLoop에서 실제 경과 시간(초) 계산
const dt = Math.min((timestamp - lastTime) / 1000, 0.05);

// 각 update()에서 60fps 기준 가상 프레임 수로 환산
const dtF = dt * 60;
```

- `dt`: 직전 프레임으로부터 경과한 실제 시간(초)
- `dtF`: `dt * 60`으로 환산한 "60fps 기준 가상 프레임 수". 기존 수치를 그대로 유지하면서 fps 독립성 확보
- `dt` 최대값을 `0.05`(50ms)로 제한 — 탭 전환 복귀 시 물리 연산이 폭발하는 문제 방지

### 변경 항목 상세

#### FPS 고정 로직 제거
```js
// 제거된 코드
const TARGET_FPS = 61;
const FPS_INTERVAL = 1000 / TARGET_FPS;
if (elapsed > FPS_INTERVAL) { ... }
```
- `requestAnimationFrame`의 매 콜백에서 바로 물리 연산 수행

#### 이동 (`GameObject.update`)
```js
// 수정 전
this.x += this.vx;

// 수정 후
this.x += this.vx * dtF;
```

#### 마찰 — 지수 마찰로 변환 (`GameObject.update`)
```js
// 수정 전: 선형 적용 → fps마다 감속 곡선이 달라짐
this.vx *= this.friction;

// 수정 후: 지수 마찰 → pow(0.92, dtF)
// 30fps(dtF=2): pow(0.92, 2) ≈ 0.846 → 60fps 2프레임 적용과 동일
this.vx *= Math.pow(this.friction, dtF);
```

#### 가속도 (`Player.handleInput`)
```js
// 수정 전
const currentAccel = this.accel * accelMult * scale;

// 수정 후
const currentAccel = this.accel * accelMult * scale * dtF;
```

#### 모든 타이머 (`Player.update`)
```js
// 수정 전
if (this.cooldown > 0) this.cooldown--;

// 수정 후
if (this.cooldown > 0) this.cooldown -= dtF;
```
대상: `cooldown`, `hitTimer`, `dashCooldown`, `dashTimer`, `stunTimer`, `invTimer`, `reloadTimer`

#### 힐링 타이머 (게임 루프)
```js
// 수정 전
p.healTimer++;

// 수정 후
p.healTimer += dt * 60;
```

#### CPU 발사 확률 (`CPUPlayer.updateAI`)
```js
// 수정 전: 프레임당 6% 확률 → fps가 높을수록 더 자주 발사
if (Math.random() < 0.06)

// 수정 후: dtF로 스케일 → 초당 발사 빈도 일정
if (Math.random() < 0.06 * (dt * 60))
```

#### HealingZone 애니메이션
```js
// 수정 전
this.pulse += 0.05;

// 수정 후
this.pulse += 0.05 * dt * 60;
```

#### `update()` 메서드 시그니처 변경
모든 클래스의 `update()` 및 `updateAI()`에 `dt` 파라미터 추가:

| 클래스 | 변경 전 | 변경 후 |
|---|---|---|
| `GameObject` | `update(w, h)` | `update(w, h, dt)` |
| `Player` | `update(w, h)` | `update(w, h, dt)` |
| `Player` | `handleInput(keys)` | `handleInput(keys, dt)` |
| `Bullet` | `update(w, h)` | `update(w, h, dt)` |
| `Particle` | `update(w, h)` | `update(w, h, dt)` |
| `HealingZone` | `update(w, h)` | `update(w, h, dt)` |
| `CPUPlayer` | `updateAI(..., w, h)` | `updateAI(..., w, h, dt)` |

> `Obstacle.update()`는 위치 계산만 수행하므로 변경 없음
