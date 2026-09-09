import Phaser from 'phaser';
import { TUNING } from '../config/tuning';
import { LEVEL_1, SPAWN, SOLID } from '../config/level1';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { InputSystem } from '../systems/input';
import {
  clearRuns,
  formatTime,
  loadRuns,
  saveRun,
  type RankedRecord,
} from '../systems/leaderboard';

type Phase = 'playing' | 'cleared' | 'gameover';

export class GameScene extends Phaser.Scene {
  private controls!: InputSystem;
  private player!: Player;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private enemies!: Phaser.Physics.Arcade.Group;
  private coins!: Phaser.Physics.Arcade.StaticGroup;
  private goals!: Phaser.Physics.Arcade.StaticGroup;

  private hud!: Phaser.GameObjects.Text;
  private debugHud!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private boardPanel!: Phaser.GameObjects.Text;

  private score = 0;
  private lives = TUNING.rules.startLives;
  private coinsLeft = 0;
  private coinsTaken = 0;
  private elapsedMs = 0;
  private phase: Phase = 'playing';
  private killY = 0;
  private debug = false;

  /** 這一輪存檔後拿到的名次，用來在榜上標示「就是這筆」 */
  private highlightAt: number | null = null;

  constructor() {
    super('Game');
  }

  create() {
    const ts = TUNING.world.tileSize;
    const cols = Math.max(...LEVEL_1.map((r) => r.length));
    const worldW = cols * ts;
    const worldH = LEVEL_1.length * ts;

    this.score = 0;
    this.lives = TUNING.rules.startLives;
    this.coinsLeft = 0;
    this.coinsTaken = 0;
    this.elapsedMs = 0;
    this.highlightAt = null;
    this.phase = 'playing';
    this.killY = worldH + 160;

    this.cameras.main.setBackgroundColor('#1b2030');
    this.physics.world.setBounds(0, 0, worldW, worldH);

    this.solids = this.physics.add.staticGroup();
    this.enemies = this.physics.add.group();
    this.coins = this.physics.add.staticGroup();
    this.goals = this.physics.add.staticGroup();
    this.buildLevel();

    this.controls = new InputSystem(this);
    this.player = new Player(this, SPAWN.tx * ts + ts / 2, SPAWN.ty * ts);

    // --- 碰撞規則 ---
    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(this.enemies, this.solids);
    // 敵人用 overlap 而不是 collider：踩頭要能穿過去，不能被擋住
    this.physics.add.overlap(this.player, this.enemies, (_p, e) =>
      this.hitEnemy(e as Enemy),
    );
    this.physics.add.overlap(this.player, this.coins, (_p, c) =>
      this.collectCoin(c as Phaser.Physics.Arcade.Sprite),
    );
    this.physics.add.overlap(this.player, this.goals, () => this.clearLevel());

    const cam = this.cameras.main;
    cam.setBounds(0, 0, worldW, worldH);
    cam.startFollow(this.player, true, TUNING.camera.lerp, TUNING.camera.lerp);
    cam.setDeadzone(TUNING.camera.deadzoneWidth, TUNING.camera.deadzoneHeight);

    this.buildHud();

    const kb = this.input.keyboard!;
    kb.on('keydown-B', () => this.toggleDebug());
    kb.on('keydown-R', () => this.scene.restart());
    kb.on('keydown-L', () => this.toggleBoard());
    // Shift + X：清空排行榜（單獨按 X 太容易誤觸）
    kb.on('keydown-X', (ev: KeyboardEvent) => {
      if (!ev.shiftKey) return;
      clearRuns();
      this.highlightAt = null;
      if (this.boardPanel.visible) this.showBoard();
    });
  }

  update(_time: number, delta: number) {
    if (this.phase !== 'playing') return;

    this.elapsedMs += delta;
    this.player.tick(delta, this.controls.read());
    (this.enemies.getChildren() as Enemy[]).forEach((e) => e.tick());

    if (this.player.y > this.killY) this.loseLife();
    this.refreshHud();
    if (this.debug) this.updateDebugHud();
  }

  // --- 關卡 ---------------------------------------------------------------

  private buildLevel() {
    const ts = TUNING.world.tileSize;

    LEVEL_1.forEach((line, ty) => {
      for (let tx = 0; tx < line.length; tx++) {
        const cx = tx * ts + ts / 2;
        const cy = ty * ts + ts / 2;

        switch (line[tx]) {
          case SOLID:
            this.solids.create(cx, cy, 'tile').refreshBody();
            break;
          case 'e':
            this.enemies.add(new Enemy(this, cx, cy, this.isSolidAt));
            break;
          case 'o': {
            const coin = this.coins.create(cx, cy, 'coin') as Phaser.Physics.Arcade.Sprite;
            coin.refreshBody();
            this.coinsLeft++;
            this.tweens.add({
              targets: coin,
              y: cy - 4,
              duration: 700,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut',
            });
            break;
          }
          case 'F':
            // 旗桿底部對齊這一格的底邊
            this.goals.create(cx, cy + ts / 2 - 36, 'goal').refreshBody();
            break;
        }
      }
    });
  }

  /** 給 Enemy 做邊緣偵測用。用箭頭函式綁定 this。 */
  private isSolidAt = (tx: number, ty: number): boolean => {
    const row = LEVEL_1[ty];
    return row !== undefined && row[tx] === SOLID;
  };

  // --- 玩法規則 -----------------------------------------------------------

  private hitEnemy(enemy: Enemy) {
    if (enemy.squashed || this.phase !== 'playing') return;

    const pb = this.player.body as Phaser.Physics.Arcade.Body;
    const eb = enemy.body as Phaser.Physics.Arcade.Body;

    // 踩頭判定：正在下墜，而且腳底還在敵人身體的上緣附近
    const falling = pb.velocity.y > 0;
    const fromAbove = pb.bottom <= eb.top + eb.height * 0.5;

    if (falling && fromAbove) {
      enemy.squash();
      this.player.bounce();
      this.addScore(TUNING.rules.stompScore);
      this.cameras.main.shake(80, 0.004);
    } else if (this.player.hurt(enemy.x)) {
      this.loseLife();
    }
  }

  private collectCoin(coin: Phaser.Physics.Arcade.Sprite) {
    if (!coin.active) return;
    this.tweens.killTweensOf(coin);
    coin.destroy();
    this.coinsLeft--;
    this.coinsTaken++;
    this.addScore(TUNING.rules.coinScore);
  }

  private addScore(n: number) {
    this.score += n;
    this.refreshHud();
  }

  private loseLife() {
    this.lives--;
    this.refreshHud();

    if (this.lives <= 0) {
      this.phase = 'gameover';
      this.showBanner('GAME OVER\n按 R 重新開始', '#ff8a80');
      this.finishRun(false);
      return;
    }

    const ts = TUNING.world.tileSize;
    this.player.reset(SPAWN.tx * ts + ts / 2, SPAWN.ty * ts);
    this.cameras.main.flash(160, 0, 0, 0);
  }

  private clearLevel() {
    if (this.phase !== 'playing') return;
    this.phase = 'cleared';
    this.player.setVelocity(0, 0);
    const bonus = this.coinsLeft === 0 ? 1000 : 0;
    this.score += bonus;
    this.refreshHud();
    this.showBanner(
      bonus ? 'LEVEL CLEAR!\n全金幣獎勵 +1000\n按 R 再玩一次' : 'LEVEL CLEAR!\n按 R 再玩一次',
      '#a5d6a7',
    );
    this.finishRun(true);
  }

  // --- 排行榜 -------------------------------------------------------------

  /** 一輪結束（通關或死光）就寫進 localStorage，並把榜單攤開來給玩家看。 */
  private finishRun(cleared: boolean) {
    const at = Date.now();
    this.highlightAt = at;

    const { rank, board } = saveRun({
      score: this.score,
      timeMs: Math.round(this.elapsedMs),
      coins: this.coinsTaken,
      cleared,
      at,
    });

    // 讓玩家先看到結算 banner，再滑出排行榜
    this.time.delayedCall(900, () => this.showBoard(board, rank));
  }

  private toggleBoard() {
    if (this.boardPanel.visible) this.boardPanel.setVisible(false);
    else this.showBoard();
  }

  private showBoard(board?: RankedRecord[], rank?: number | null) {
    const rows = board ?? loadRuns();
    const lines = ['— 個人成績排行榜 —', ''];

    if (rows.length === 0) {
      lines.push('還沒有任何紀錄，先跑一輪吧！');
    } else {
      lines.push('#   SCORE   TIME    金幣  結果');
      rows.forEach((r) => {
        const mine = r.at === this.highlightAt ? '▶' : ' ';
        lines.push(
          [
            `${mine}${String(r.rank).padStart(2, ' ')}`,
            String(r.score).padStart(6, '0'),
            formatTime(r.timeMs).padStart(6, ' '),
            String(r.coins).padStart(3, ' '),
            r.cleared ? ' 通關' : ' 陣亡',
          ].join(' '),
        );
      });
    }

    if (rank === null) lines.push('', '這次沒進榜，再接再厲！');
    lines.push('', 'L 開關榜單 ・ Shift+X 清空 ・ R 重來');

    this.boardPanel.setText(lines).setVisible(true);
  }

  // --- HUD ---------------------------------------------------------------

  private buildHud() {
    this.hud = this.add
      .text(8, 6, '', { fontFamily: 'monospace', fontSize: '14px', color: '#e8eef7' })
      .setScrollFactor(0)
      .setDepth(1000);

    this.debugHud = this.add
      .text(8, 44, '', { fontFamily: 'monospace', fontSize: '11px', color: '#8fa7c4' })
      .setScrollFactor(0)
      .setDepth(1000);

    this.banner = this.add
      .text(320, 90, '', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
        align: 'center',
        backgroundColor: '#00000099',
        padding: { x: 16, y: 12 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1001)
      .setVisible(false);

    this.boardPanel = this.add
      .text(320, 210, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#e8eef7',
        align: 'left',
        lineSpacing: 2,
        backgroundColor: '#0d1220dd',
        padding: { x: 14, y: 10 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1002)
      .setVisible(false);

    this.refreshHud();
  }

  private refreshHud() {
    this.hud.setText(
      `SCORE ${String(this.score).padStart(5, '0')}   LIVES ${'♥'.repeat(Math.max(0, this.lives))}   COINS ${this.coinsLeft}   TIME ${formatTime(this.elapsedMs)}`,
    );
  }

  private showBanner(text: string, color: string) {
    this.banner.setText(text).setColor(color).setVisible(true);
  }

  private updateDebugHud() {
    const s = this.player.lastState;
    const b = this.player.body as Phaser.Physics.Arcade.Body;
    this.debugHud.setText(
      [
        `FPS      ${Math.round(this.game.loop.actualFps)}`,
        `vel      ${b.velocity.x.toFixed(0)}, ${b.velocity.y.toFixed(0)}`,
        `onGround ${s.onGround}`,
        `coyote   ${s.coyote.toFixed(0)}ms`,
        `buffer   ${s.buffer.toFixed(0)}ms`,
        `enemies  ${this.enemies.countActive()}`,
      ].join('\n'),
    );
  }

  private toggleDebug() {
    this.debug = !this.debug;
    this.physics.world.drawDebug = this.debug;
    if (!this.physics.world.debugGraphic) this.physics.world.createDebugGraphic();
    this.physics.world.debugGraphic.setVisible(this.debug);
    if (!this.debug) {
      this.physics.world.debugGraphic.clear();
      this.debugHud.setText('');
    }
  }
}
