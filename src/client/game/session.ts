// Sesión de juego: corre la simulación a paso fijo (local) o la recibe del servidor (online).
import { BotAI } from '../../shared/ai';
import { DT, createMatch, step } from '../../shared/sim';
import type { GameEvent, MatchConfig, MatchState, PlayerInput } from '../../shared/types';
import { input } from './input';

export interface Session {
  readonly kind: 'local' | 'online';
  state: MatchState;
  localIds: number[];
  paused: boolean;
  /** avanza en tiempo real; devuelve eventos nuevos */
  update(dt: number): GameEvent[];
  /** interpolación entre ticks */
  alpha: number;
  prev: Map<number, { x: number; y: number }>;
  canPause: boolean;
  dispose(): void;
  /** mensaje de estado (online) */
  status?: string;
}

export class LocalSession implements Session {
  readonly kind = 'local';
  state: MatchState;
  localIds: number[];
  paused = false;
  alpha = 0;
  prev = new Map<number, { x: number; y: number }>();
  canPause = true;
  private acc = 0;
  private ai: BotAI;
  private events: GameEvent[] = [];
  /** velocidad de simulación (1 = normal) */
  speed = 1;

  constructor(config: MatchConfig) {
    this.state = createMatch(config);
    this.localIds = this.state.players.filter((p) => !p.bot).map((p) => p.id);
    this.ai = new BotAI(config.seed ^ 0x5f3759df);
    input.localCount = Math.max(1, this.localIds.length);
  }

  update(dt: number): GameEvent[] {
    this.events = [];
    if (this.paused) return this.events;
    this.acc += Math.min(0.25, dt) * this.speed;
    let steps = 0;
    while (this.acc >= DT && steps < 8) {
      this.acc -= DT;
      steps++;
      for (const p of this.state.players) this.prev.set(p.id, { x: p.x, y: p.y });
      const inputs: Record<number, PlayerInput> = this.ai.inputs(this.state);
      for (const p of this.state.players) {
        if (p.bot) continue;
        inputs[p.id] = input.read(p.local ?? 0);
      }
      step(this.state, inputs);
      if (this.state.events.length) this.events.push(...this.state.events);
    }
    this.alpha = this.acc / DT;
    return this.events;
  }

  dispose() {
    this.ai.reset();
  }
}
