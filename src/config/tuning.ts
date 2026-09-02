/**
 * 所有「手感」數值集中在這裡。
 * 覺得跳太重、跑太滑、落地太黏 —— 都只改這個檔案。
 */
export const TUNING = {
  world: {
    gravityY: 1200,      // 重力加速度 (px/s^2)
    tileSize: 32,
  },

  player: {
    // 碰撞框大小（貼圖是 32x32，比碰撞框寬 —— 伸出去的雙手不吃判定，對玩家寬容）
    width: 20,
    height: 32,

    // 水平移動
    maxSpeed: 220,       // 最高跑速 (px/s)
    accelGround: 2000,   // 地面加速度 —— 越大越「跟手」
    accelAir: 1400,      // 空中加速度 —— 比地面小才有重量感
    frictionGround: 2400, // 地面煞車力 —— 越小越滑（馬力歐冰面就是調這個）
    frictionAir: 300,    // 空中阻力

    // 跳躍
    jumpVelocity: -520,  // 起跳初速（負值 = 往上）
    maxFallSpeed: 900,   // 終端速度，避免掉太快穿牆

    // ★ 手感三件事
    coyoteMs: 100,       // 離開地面後仍可跳的寬限時間
    jumpBufferMs: 120,   // 落地前預按跳躍的緩衝時間
    jumpCutMultiplier: 0.4, // 放開跳躍鍵時，上升速度乘以這個值（可變跳躍高度）

    // 受傷 / 踩頭
    stompBounce: -380,   // 踩死敵人後的彈跳力（比一般跳躍小，才有「輕點」感）
    invincibleMs: 1200,  // 受傷後無敵時間（會閃爍）
    controlLockMs: 220,  // 受傷後失去操控的時間，讓擊退真的推得動
    knockbackX: 200,
    knockbackY: -260,
  },

  enemy: {
    width: 26,
    height: 26,
    speed: 60,           // 巡邏速度
    turnAtEdge: true,    // true = 走到平台邊緣會回頭（栗寶寶其實不會，關掉更兇）
  },

  rules: {
    startLives: 3,
    coinScore: 100,
    stompScore: 200,
  },

  camera: {
    lerp: 0.12,          // 跟隨平滑度 (0~1)，越小越懶散
    deadzoneWidth: 120,  // 死區：角色在這範圍內移動，鏡頭不動
    deadzoneHeight: 80,
  },
} as const;
