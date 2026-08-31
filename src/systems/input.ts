import Phaser from 'phaser';

/** 每一幀從鍵盤讀出來的意圖。實體只認這個介面，之後接手把/觸控不用改角色程式碼。 */
export interface InputState {
  left: boolean;
  right: boolean;
  jumpDown: boolean;
  jumpJustPressed: boolean;
  jumpJustReleased: boolean;
}

export class InputSystem {
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) throw new Error('需要鍵盤輸入');

    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      left: kb.addKey(K.LEFT),
      right: kb.addKey(K.RIGHT),
      a: kb.addKey(K.A),
      d: kb.addKey(K.D),
      space: kb.addKey(K.SPACE),
      up: kb.addKey(K.UP),
      w: kb.addKey(K.W),
    };

    // 避免空白鍵 / 方向鍵捲動頁面
    kb.addCapture([K.LEFT, K.RIGHT, K.UP, K.DOWN, K.SPACE]);
  }

  read(): InputState {
    const jumpKeys = [this.keys.space, this.keys.up, this.keys.w];
    return {
      left: this.keys.left.isDown || this.keys.a.isDown,
      right: this.keys.right.isDown || this.keys.d.isDown,
      jumpDown: jumpKeys.some((k) => k.isDown),
      // 用 filter 而不是 some：JustDown/JustUp 會消耗按鍵狀態，
      // some 短路的話沒被讀到的那顆鍵會留著旗標，下一幀誤觸發。
      jumpJustPressed: jumpKeys.filter((k) => Phaser.Input.Keyboard.JustDown(k)).length > 0,
      jumpJustReleased: jumpKeys.filter((k) => Phaser.Input.Keyboard.JustUp(k)).length > 0,
    };
  }
}
