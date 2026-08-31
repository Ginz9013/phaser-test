import Phaser from 'phaser';
import { TUNING } from '../config/tuning';
import type { InputState } from '../systems/input';

export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  private coyoteTimer = 0;      // > 0 表示還在「土狼時間」內，可以跳
  private jumpBufferTimer = 0;  // > 0 表示玩家最近按過跳躍，等落地就執行
  private facing: 1 | -1 = 1;

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

    // --- 計時器 ---
    this.coyoteTimer = onGround ? t.coyoteMs : this.coyoteTimer - dt;
    this.jumpBufferTimer = input.jumpJustPressed
      ? t.jumpBufferMs
      : this.jumpBufferTimer - dt;

    // --- 水平移動：手動加速 / 煞車，比 setAccelerationX 好調 ---
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const accel = onGround ? t.accelGround : t.accelAir;
    const friction = onGround ? t.frictionGround : t.frictionAir;
    let vx = this.body.velocity.x;

    if (dir !== 0) {
      vx = Phaser.Math.Clamp(vx + dir * accel * dts, -t.maxSpeed, t.maxSpeed);
      this.facing = dir as 1 | -1;
    } else {
      const drop = friction * dts;
      vx = Math.sign(vx) * Math.max(0, Math.abs(vx) - drop);
    }
    this.setVelocityX(vx);
    this.setFlipX(this.facing === -1);

    // --- 跳躍：coyote time + jump buffer 一起判斷 ---
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.setVelocityY(t.jumpVelocity);
      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0; // 消耗掉，避免空中連跳
    }

    // --- 可變跳躍高度：放開鍵就把上升速度砍掉 ---
    if (input.jumpJustReleased && this.body.velocity.y < 0) {
      this.setVelocityY(this.body.velocity.y * t.jumpCutMultiplier);
    }

    this.lastState = {
      onGround,
      coyote: Math.max(0, this.coyoteTimer),
      buffer: Math.max(0, this.jumpBufferTimer),
    };
  }
}
