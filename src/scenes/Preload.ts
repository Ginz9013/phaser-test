import Phaser from 'phaser';
import { TUNING } from '../config/tuning';

/**
 * 主角用真的貼圖，其餘還是色塊 placeholder。
 * public/assets/player.png 由 `npm run sprite:player` 從原始素材產生，
 * 已經是遊戲尺寸 32x32，載進來 1:1 顯示，不要再縮放。
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    const ts = TUNING.world.tileSize;
    const e = TUNING.enemy;

    this.load.image('player', 'assets/player.png');

    this.makeRect('tile', ts, ts, 0x3c4a6b, 0x556487);
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
