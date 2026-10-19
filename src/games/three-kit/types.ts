import type { ArcadeCue } from '../premium-kit/core';

export interface WorldView {
  resize(width: number, height: number, pixelRatio: number): void;
  render(dt: number, held: boolean, reduced: boolean, cues: readonly ArcadeCue[]): void;
  pointer?(phase: 'down' | 'move' | 'up' | 'cancel', x: number, y: number, pointerId: number): void;
  dispose(): void;
  diagnostics?(): Record<string, number>;
}
