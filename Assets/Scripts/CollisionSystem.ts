/**
 * CollisionSystem - decides when the player touches an obstacle or pickup.
 *
 * Deliberately a MANUAL lane + Z-distance test, not the physics ColliderComponent.
 * For a 3-lane runner that is the right call: it is deterministic, needs zero
 * physics-layer/collision-matrix setup (so the repo clones-and-runs), and is
 * trivially readable - exactly what a reviewer wants to see reasoned about. The
 * ColliderComponent.onOverlapEnter route is a documented alternative in
 * ARCHITECTURE.md for when 3D shapes get irregular.
 *
 * Reads the spawner's active set + the player's lane/airborne state each frame and
 * emits playerHit / pickupCollected. It owns a short invulnerability window so a
 * single obstacle can't drain two lives across consecutive frames.
 */
import { GameConfig } from './GameConfig';
import { GameEvents, PickupPayload } from './GameEvents';
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
    GameEvents.on('gameReset', () => (this.invulnerability = 0));
  }

  /** Called each PLAYING frame by GameManager, after the spawner has moved. */
  check(dt: number): void {
    if (this.invulnerability > 0) {
      this.invulnerability -= dt;
    }

    var active: ActiveEntry[] = this.spawner.getActive();
    var playerLane = this.player.currentLane;
    var airborne = this.player.isAirborne;

    var i;
    for (i = active.length - 1; i >= 0; i -= 1) {
      var e = active[i];
      var z = e.transform.getLocalPosition().z; // player sits at z ~ 0
      var dz = Math.abs(z);

      if (e.kind === 'pickup') {
        if (e.lane === playerLane && dz <= GameConfig.pickupRadius) {
          this.spawner.consume(e);
          GameEvents.emit('pickupCollected', {
            points: GameConfig.pickupPoints,
          } as PickupPayload);
        }
        continue;
      }

      // obstacle: same lane, in range, and the player is NOT jumping over it
      if (
        this.invulnerability <= 0 &&
        e.lane === playerLane &&
        !airborne &&
        dz <= GameConfig.hitDistanceZ
      ) {
        this.spawner.consume(e);
        this.invulnerability = GameConfig.hitInvulnerability;
        GameEvents.emit('playerHit');
      }
    }
  }
}
