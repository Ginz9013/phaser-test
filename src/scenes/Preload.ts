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

    this.makeRect('tile', ts, ts, 0x3c4a6b, 0x556487);
    this.makeRect('player', p.width, p.height, 0x4fc3f7, 0xb3e5fc);
  }

  create() {
    this.scene.start('Game');
  }

  private makeRect(key: string, w: number, h: number, fill: number, stroke: number) {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(fill, 1).fillRect(0, 0, w, h);
    g.lineStyle(2, stroke, 1).strokeRect(1, 1, w - 2, h - 2);
    g.generateTexture(key, w, h);
    g.destroy();
  }
}
