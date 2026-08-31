import Phaser from 'phaser';
import { TUNING } from '../config/tuning';
import type { InputState } from '../systems/input';

export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  private coyoteTimer = 0;      // > 0 表示還在「土狼時間」內，可以跳
  private jumpBufferTimer = 0;  // > 0 表示玩家最近按過跳躍，等落地就執行
  private facing: 1 | -1 = 1;
  private invincibleUntil = 0;   // 受傷後的無敵時間
  private controlLockUntil = 0;  // 受傷後暫時奪走操控，擊退才推得動

  /** debug HUD 用 */
  public lastState = { onGround: false, coyote: 0, buffer: 0 };

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    const t = TUNING.player;
    this.body.setSize(t.width, t.height);
    this.body.setMaxVelocity(10000, t.maxFallSpeed);
    this.setCollideWorldBounds(false);
    this.setOrigin(0.5, 0.5);
  }

  /** @param dt 毫秒 */
  tick(dt: number, input: InputState) {
    const t = TUNING.player;
    const dts = dt / 1000;
    const onGround = this.body.blocked.down || this.body.touching.down;
    const now = this.scene.time.now;
    const locked = now < this.controlLockUntil;

    // 無敵時閃爍（用時間取餘數，不必管理 tween 生命週期）
    this.setAlpha(now < this.invincibleUntil && Math.floor(now / 80) % 2 === 0 ? 0.3 : 1);

    // --- 計時器 ---
    this.coyoteTimer = onGround ? t.coyoteMs : this.coyoteTimer - dt;
    this.jumpBufferTimer = input.jumpJustPressed
      ? t.jumpBufferMs
      : this.jumpBufferTimer - dt;

    // --- 水平移動：手動加速 / 煞車，比 setAccelerationX 好調 ---
    const dir = locked ? 0 : (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const accel = onGround ? t.accelGround : t.accelAir;
    const friction = onGround ? t.frictionGround : t.frictionAir;
    let vx = this.body.velocity.x;

    if (dir !== 0) {
      vx = Phaser.Math.Clamp(vx + dir * accel * dts, -t.maxSpeed, t.maxSpeed);
      this.facing = dir as 1 | -1;
    } else if (!locked) {
      const drop = friction * dts;
      vx = Math.sign(vx) * Math.max(0, Math.abs(vx) - drop);
    }
    this.setVelocityX(vx);
    this.setFlipX(this.facing === -1);

    // --- 跳躍：coyote time + jump buffer 一起判斷 ---
    if (!locked && this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.setVelocityY(t.jumpVelocity);
      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0; // 消耗掉，避免空中連跳
    }

    // --- 可變跳躍高度：放開鍵就把上升速度砍掉 ---
    if (!locked && input.jumpJustReleased && this.body.velocity.y < 0) {
      this.setVelocityY(this.body.velocity.y * t.jumpCutMultiplier);
    }

    this.lastState = {
      onGround,
      coyote: Math.max(0, this.coyoteTimer),
      buffer: Math.max(0, this.jumpBufferTimer),
    };
  }

  get invincible() {
    return this.scene.time.now < this.invincibleUntil;
  }

  /** 踩到敵人頭上的回彈 */
  bounce() {
    this.setVelocityY(TUNING.player.stompBounce);
    this.jumpBufferTimer = 0;
  }

  /**
   * 受傷。無敵中會回傳 false（呼叫端據此決定要不要扣血）。
   * @param fromX 傷害來源的 x，用來決定往哪邊被擊退
   */
  hurt(fromX: number): boolean {
    if (this.invincible) return false;

    const t = TUNING.player;
    const now = this.scene.time.now;
    this.invincibleUntil = now + t.invincibleMs;
    this.controlLockUntil = now + t.controlLockMs;

    const away = this.x < fromX ? -1 : 1;
    this.setVelocity(away * t.knockbackX, t.knockbackY);
    return true;
  }

  /** 重生時把所有狀態歸零 */
  reset(x: number, y: number) {
    this.setPosition(x, y);
    this.setVelocity(0, 0);
    this.setAlpha(1);
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.invincibleUntil = 0;
    this.controlLockUntil = 0;
  }
}
