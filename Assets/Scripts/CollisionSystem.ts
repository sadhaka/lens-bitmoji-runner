/**
 * CollisionSystem - decides when the player touches an obstacle or pickup.
 *
 * Deliberately a MANUAL test, not the physics ColliderComponent. For a lane runner
 * that is the right call: deterministic, zero physics-layer/collision-matrix setup
 * (so the repo clones-and-runs), and trivially readable. The ColliderComponent
 * route is a documented alternative in ARCHITECTURE.md for irregular 3D shapes.
 *
 * The test has three axes, not two:
 *   - LANE     : same lane as the player;
 *   - DEPTH    : within hitDistanceZ in WORLD Z (so the player + obstacles can sit
 *                under different parents without a hidden "both at z=0" assumption);
 *   - HEIGHT   : the player's current height vs. the obstacle's clearHeight. Jump
 *                high enough and you pass over it. This makes "jump over vs. must
 *                dodge" a property of the obstacle (its clearHeight), not a global
 *                boolean - so low hurdles and tall barriers are a data change, not
 *                a code change.
 *
 * Runs each frame AFTER movement (GameManager order). It owns a short
 * invulnerability window so one obstacle can't drain two lives across frames.
 */
import { GameConfig } from './GameConfig';
import { GameEvents, PickupPayload, releaseOnDestroy } from './GameEvents';
import { ObstacleSpawner, ActiveEntry } from './ObstacleSpawner';
import { PlayerController } from './PlayerController';

@component
export class CollisionSystem extends BaseScriptComponent {
  @input
  spawner: ObstacleSpawner;
  @input
  player: PlayerController;

  private invulnerability = 0;

  onAwake(): void {
    releaseOnDestroy(this, [
      GameEvents.on('gameReset', () => (this.invulnerability = 0)),
    ]);
  }

  /** Called each PLAYING frame by GameManager, after everything has moved. */
  check(dt: number): void {
    if (this.invulnerability > 0) {
      this.invulnerability -= dt;
    }

    var active: ActiveEntry[] = this.spawner.getActive();
    var playerLane = this.player.currentLane;
    var playerHeight = this.player.heightAboveGround;
    var playerZ = this.player.worldZ;

    var i;
    for (i = active.length - 1; i >= 0; i -= 1) {
      var e = active[i];
      var dz = Math.abs(e.transform.getWorldPosition().z - playerZ);

      if (e.kind === 'pickup') {
        if (e.lane === playerLane && dz <= GameConfig.pickupRadius) {
          this.spawner.consume(e);
          GameEvents.emit('pickupCollected', {
            points: GameConfig.pickupPoints,
          } as PickupPayload);
        }
        continue;
      }

      // obstacle: same lane, in depth range, and NOT cleared by jumping high enough
      if (
        this.invulnerability <= 0 &&
        e.lane === playerLane &&
        dz <= GameConfig.hitDistanceZ &&
        playerHeight < e.clearHeight
      ) {
        this.spawner.consume(e);
        this.invulnerability = GameConfig.hitInvulnerability;
        GameEvents.emit('playerHit');
      }
    }
  }
}
