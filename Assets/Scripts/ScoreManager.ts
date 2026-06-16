/**
 * ScoreManager - owns the score number and nothing else.
 *
 * Two sources of score: passive survival (distancePointsPerSecond) and pickups
 * (pickupCollected events). It never touches the UI - it just emits
 * `scoreChanged`, and the UIController paints it. Single responsibility.
 */
import { GameConfig } from './GameConfig';
import {
  GameEvents,
  PickupPayload,
  ScoreChangedPayload,
} from './GameEvents';

@component
export class ScoreManager extends BaseScriptComponent {
  private score = 0;
  private distanceAccumulator = 0;

  onAwake(): void {
    GameEvents.on('gameReset', () => this.reset());
    GameEvents.on('pickupCollected', (p: PickupPayload) =>
      this.add(p ? p.points : GameConfig.pickupPoints)
    );
  }

  /** Called by the GameManager game-loop each playing frame. */
  tickDistance(dt: number): void {
    this.distanceAccumulator += GameConfig.distancePointsPerSecond * dt;
    // only commit whole points so the UI counter reads cleanly
    var whole = Math.floor(this.distanceAccumulator);
    if (whole > 0) {
      this.distanceAccumulator -= whole;
      this.add(whole);
    }
  }

  private add(points: number): void {
    this.score += points;
    var payload: ScoreChangedPayload = { score: this.score };
    GameEvents.emit('scoreChanged', payload);
  }

  reset(): void {
    this.score = 0;
    this.distanceAccumulator = 0;
    GameEvents.emit('scoreChanged', { score: 0 } as ScoreChangedPayload);
  }

  get current(): number {
    return this.score;
  }
}
