import Phaser from 'phaser';
import { TUNING } from '../config/tuning';
import { LEVEL_1, SPAWN } from '../config/level1';
import { Player } from '../entities/Player';
import { InputSystem } from '../systems/input';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private controls!: InputSystem;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private hud!: Phaser.GameObjects.Text;
  private killY = 0;
  private debug = false;

  constructor() {
    super('Game');
  }

  create() {
    const ts = TUNING.world.tileSize;
    const cols = Math.max(...LEVEL_1.map((r) => r.length));
    const rows = LEVEL_1.length;
    const worldW = cols * ts;
    const worldH = rows * ts;

    this.cameras.main.setBackgroundColor('#1b2030');
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.killY = worldH + 160; // 掉超過這條線就重生

    // --- 依 ASCII 建地形 ---
    this.solids = this.physics.add.staticGroup();
    LEVEL_1.forEach((line, ty) => {
      for (let tx = 0; tx < line.length; tx++) {
        if (line[tx] !== '#') continue;
        this.solids
          .create(tx * ts + ts / 2, ty * ts + ts / 2, 'tile')
          .refreshBody();
      }
    });

    // --- 角色 ---
    this.controls = new InputSystem(this);
    this.player = new Player(this, SPAWN.tx * ts + ts / 2, SPAWN.ty * ts);
    this.physics.add.collider(this.player, this.solids);

    // --- 鏡頭 ---
    const cam = this.cameras.main;
    cam.setBounds(0, 0, worldW, worldH);
    cam.startFollow(this.player, true, TUNING.camera.lerp, TUNING.camera.lerp);
    cam.setDeadzone(TUNING.camera.deadzoneWidth, TUNING.camera.deadzoneHeight);

    // --- HUD / debug ---
    this.hud = this.add
      .text(8, 6, '', { fontFamily: 'monospace', fontSize: '12px', color: '#8fa7c4' })
      .setScrollFactor(0)
      .setDepth(1000);

    this.physics.world.drawDebug = false;
    this.physics.world.debugGraphic?.setVisible(false);

    const kb = this.input.keyboard!;
    kb.on('keydown-B', () => this.toggleDebug());
    kb.on('keydown-R', () => this.scene.restart());
  }

  update(_time: number, delta: number) {
    const state = this.controls.read();
    this.player.tick(delta, state);

    if (this.player.y > this.killY) this.respawn();

    if (this.debug) {
      const s = this.player.lastState;
      const b = this.player.body;
      this.hud.setText(
        [
          `FPS      ${Math.round(this.game.loop.actualFps)}`,
          `vel      ${b.velocity.x.toFixed(0)}, ${b.velocity.y.toFixed(0)}`,
          `onGround ${s.onGround}`,
          `coyote   ${s.coyote.toFixed(0)}ms`,
          `buffer   ${s.buffer.toFixed(0)}ms`,
        ].join('\n'),
      );
    }
  }

  private respawn() {
    const ts = TUNING.world.tileSize;
    this.player.setPosition(SPAWN.tx * ts + ts / 2, SPAWN.ty * ts);
    this.player.setVelocity(0, 0);
    this.cameras.main.flash(150, 0, 0, 0);
  }

  private toggleDebug() {
    this.debug = !this.debug;
    this.physics.world.drawDebug = this.debug;
    if (!this.physics.world.debugGraphic) this.physics.world.createDebugGraphic();
    this.physics.world.debugGraphic.setVisible(this.debug);
    if (!this.debug) {
      this.physics.world.debugGraphic.clear();
      this.hud.setText('');
    }
  }
}
