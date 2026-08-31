import Phaser from 'phaser';
import { TUNING } from './config/tuning';
import { PreloadScene } from './scenes/Preload';
import { GameScene } from './scenes/Game';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 640,
  height: 360,
  pixelArt: true,
  backgroundColor: '#1b2030',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: TUNING.world.gravityY },
      debug: false,
    },
  },
  scene: [PreloadScene, GameScene],
});
