/**
 * Lightweight Konva type aliases for use within the canvas components.
 * vue-konva exposes nodes via `getNode()` but doesn't re-export the
 * underlying Konva types in a way that's friction-free at our usage
 * level — these tiny interfaces describe the methods we actually call.
 */

export interface KonvaNode {
  id(): string;
}

export interface KonvaStage {
  findOne(selector: string): KonvaNode | undefined;
  find(selector: string): KonvaNode[];
  position(p: { x: number; y: number }): void;
  scale(p: { x: number; y: number }): void;
  getPointerPosition(): { x: number; y: number } | null;
  batchDraw(): void;
}
