import Phaser from 'phaser';
import { TUNING } from '../config/tuning';

/**
 * 現階段不載入圖檔 —— 直接用色塊產生貼圖。
 * 等玩法定案再把這些 generateTexture 換成 this.load.spritesheet(...)。
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    const ts = TUNING.world.tileSize;
    const p = TUNING.player;
    const e = TUNING.enemy;

    this.makeRect('tile', ts, ts, 0x3c4a6b, 0x556487);
    this.makeRect('player', p.width, p.height, 0x4fc3f7, 0xb3e5fc);
    this.makeRect('enemy', e.width, e.height, 0xef5350, 0xffcdd2);
    this.makeRect('goal', 12, 72, 0x66bb6a, 0xc8e6c9);
    this.makeCircle('coin', 7, 0xffd54f, 0xfff8e1);
  }

  create() {
    this.scene.start('Game');
  }

  private makeCircle(key: string, r: number, fill: number, stroke: number) {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(fill, 1).fillCircle(r, r, r);
    g.lineStyle(2, stroke, 1).strokeCircle(r, r, r - 1);
    g.generateTexture(key, r * 2, r * 2);
    g.destroy();
  }

  private makeRect(key: string, w: number, h: number, fill: number, stroke: number) {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(fill, 1).fillRect(0, 0, w, h);
    g.lineStyle(2, stroke, 1).strokeRect(1, 1, w - 2, h - 2);
    g.generateTexture(key, w, h);
    g.destroy();
  }
}
