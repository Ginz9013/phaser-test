import Phaser from 'phaser';
import { TUNING } from '../config/tuning';

/** 栗寶寶式巡邏敵人：碰牆回頭，走到平台邊緣也回頭。 */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  private dir: 1 | -1 = -1;
  public squashed = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    /** 查詢某格是不是實心，用來做邊緣偵測 */
    private readonly isSolidAt: (tx: number, ty: number) => boolean,
  ) {
    super(scene, x, y, 'enemy');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    const e = TUNING.enemy;
    this.body.setSize(e.width, e.height);
    this.setOrigin(0.5, 0.5);
  }

  tick() {
    if (this.squashed) return;

    const e = TUNING.enemy;
    const ts = TUNING.world.tileSize;

    if (this.body.blocked.left) {
      this.dir = 1;
    } else if (this.body.blocked.right) {
      this.dir = -1;
    } else if (e.turnAtEdge && this.body.blocked.down) {
      // 往前探一格：腳邊前方沒有地板就回頭
      const aheadX = this.dir === 1 ? this.body.right + 2 : this.body.left - 2;
      const tx = Math.floor(aheadX / ts);
      const ty = Math.floor((this.body.bottom + 2) / ts);
      if (!this.isSolidAt(tx, ty)) this.dir = this.dir === 1 ? -1 : 1;
    }

    this.setVelocityX(this.dir * e.speed);
    this.setFlipX(this.dir === 1);
  }

  /** 被踩扁：壓扁動畫後移除 */
  squash() {
    if (this.squashed) return;
    this.squashed = true;
    this.body.enable = false;
    this.setVelocity(0, 0);

    this.scene.tweens.add({
      targets: this,
      scaleY: 0.25,
      y: this.y + TUNING.enemy.height * 0.35,
      alpha: 0,
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => this.destroy(),
    });
  }
}
