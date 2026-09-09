/**
 * 個人成績排行榜 —— 存在瀏覽器的 localStorage，只屬於這台裝置的這個瀏覽器。
 *
 * 設計重點：
 * 1. 對外只暴露 4 個動作（save / load / clear / rank），呼叫端不需要知道 key、
 *    JSON 格式、排序規則長什麼樣子。
 * 2. localStorage 隨時可能爆炸（無痕模式、關閉 cookie、配額滿、別人塞髒資料），
 *    所以每一次讀寫都包 try/catch，失敗就當作「沒有紀錄」，絕不讓遊戲當掉。
 * 3. 存檔格式帶版本號。以後欄位改了，直接換 KEY 版號，舊資料自然被忽略。
 */

const STORAGE_KEY = 'phaser-platformer.scores.v1';
const MAX_ENTRIES = 10;

export type RunRecord = {
  /** 總分 */
  score: number;
  /** 這一輪花了多少毫秒 */
  timeMs: number;
  /** 吃到的金幣數 */
  coins: number;
  /** 是否通關（false = GAME OVER） */
  cleared: boolean;
  /** 完成時間，Date.now() */
  at: number;
};

/** 排名後的紀錄，多帶一個名次（1 起算） */
export type RankedRecord = RunRecord & { rank: number };

/**
 * 排序規則：分數高的贏；同分則用時短的贏；再同分就看誰先達成。
 * 這是「排行榜長什麼樣子」的唯一定義，改規則只改這裡。
 */
function compare(a: RunRecord, b: RunRecord): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
  return a.at - b.at;
}

function isRecord(v: unknown): v is RunRecord {
  const r = v as RunRecord;
  return (
    !!r &&
    typeof r === 'object' &&
    typeof r.score === 'number' &&
    typeof r.timeMs === 'number' &&
    typeof r.coins === 'number' &&
    typeof r.cleared === 'boolean' &&
    typeof r.at === 'number'
  );
}

/** 讀出全部紀錄（已排序）。任何異常都回空陣列。 */
export function loadRuns(): RankedRecord[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isRecord)
      .sort(compare)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  } catch {
    return [];
  }
}

/**
 * 存進一筆新紀錄，回傳「這筆在榜上的名次」與「更新後的榜單」。
 * 沒進榜（被擠出 MAX_ENTRIES）時 rank 為 null。
 */
export function saveRun(run: RunRecord): { rank: number | null; board: RankedRecord[] } {
  const merged = [...loadRuns().map(strip), run].sort(compare).slice(0, MAX_ENTRIES);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // 存不進去（配額滿 / 隱私模式）就算了，這一輪的榜單照樣顯示給玩家看
  }

  const index = merged.findIndex((r) => r.at === run.at && r.score === run.score);
  return {
    rank: index >= 0 ? index + 1 : null,
    board: merged.map((r, i) => ({ ...r, rank: i + 1 })),
  };
}

/** 清空所有紀錄。 */
export function clearRuns(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 清不掉就算了
  }
}

/** 把毫秒排版成 M:SS.s，給 HUD 用 */
export function formatTime(ms: number): string {
  const total = Math.max(0, ms) / 1000;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

function strip(r: RankedRecord): RunRecord {
  const { rank: _rank, ...rest } = r;
  return rest;
}
