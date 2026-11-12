import type { SessionState } from "../domain/appearance.ts";

export interface MoodCard {
  state: SessionState;
  character: string;
  color: string;
  /** The state, in Japanese. */
  kanji: string;
  text: string;
}

export const moodCards: readonly MoodCard[] = [
  { state: "working", character: "default", color: "#d97757", kanji: "作業中", text: "Hops along with typing dots while Claude works on it." },
  { state: "needsPermission", character: "robot", color: "#d97757", kanji: "許可待ち", text: "Blinks its tile orange until you allow or deny. Hard to miss from across the room." },
  { state: "needsInput", character: "ghost", color: "#4f7cff", kanji: "質問", text: "Rings itself in orange and raises a question mark when Claude asks you something." },
  { state: "compacting", character: "cat", color: "#a66cff", kanji: "圧縮中", text: "Squints while its conversation gets compacted." },
  { state: "done", character: "default", color: "#4cd964", kanji: "完了", text: "Holds up a green check until you reply." },
  { state: "sleeping", character: "robot", color: "#3ccfe6", kanji: "居眠り", text: "Dozes off five minutes after it finishes." },
  { state: "error", character: "ghost", color: "#d97757", kanji: "失敗", text: "Shakes its head when a turn fails." },
  { state: "closed", character: "cat", color: "#e8e8e8", kanji: "終了", text: "Fades to gray when its process stops. A click still reopens it." },
];
