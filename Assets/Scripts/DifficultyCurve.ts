/**
 * DifficultyCurve - the single source of truth for "how hard is it right now".
 *
 * The task asks the game to get harder over time. Rather than sprinkle `if
 * (elapsed > X)` checks around, every system that cares about pace asks this one
 * object: PlayerController/Spawnable read `currentSpeed`, the spawner reads
 * `currentSpawnInterval`. Pure math on elapsed time - deterministic + trivial to
 * retune from GameConfig.
 *
 * Plain class (owned by GameManager), not a ScriptComponent: it has no scene
 * presence, just state + formulas.
 */
import { GameConfig } from './GameConfig';

export class DifficultyCurve {
  private elapsed = 0;
  private running = false;

  start(): void {
    this.elapsed = 0;
    this.running = true;
  }

  stop(): void {
    this.running = false;
  }

  /** Advance the clock; call once per frame from GameManager while playing. */
  tick(dt: number): void {
    if (this.running) {
      this.elapsed += dt;
    }
  }

  get elapsedSeconds(): number {
    return this.elapsed;
  }

  /** World scroll speed (cm/s), ramping from baseSpeed up to the maxSpeed cap. */
  get currentSpeed(): number {
    var s = GameConfig.baseSpeed + GameConfig.speedRampPerSecond * this.elapsed;
    return Math.min(s, GameConfig.maxSpeed);
  }

  /** Seconds between spawns, shrinking toward the floor as the run goes on. */
  get currentSpawnInterval(): number {
    var iv =
      GameConfig.baseSpawnInterval -
      GameConfig.spawnIntervalRampPerSecond * this.elapsed;
    return Math.max(iv, GameConfig.minSpawnInterval);
  }

  /** 0..1 normalised intensity - handy for VFX/audio that scale with tension. */
  get intensity01(): number {
    var range = GameConfig.maxSpeed - GameConfig.baseSpeed;
    if (range <= 0) {
      return 1;
    }
    return Math.min((this.currentSpeed - GameConfig.baseSpeed) / range, 1);
  }
}
