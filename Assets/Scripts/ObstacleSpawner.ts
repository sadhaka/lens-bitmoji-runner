/**
 * ObstacleSpawner - spawns, moves, and recycles obstacles + pickups.
 *
 * Responsibilities:
 *   - on a difficulty-scaled timer, pick a lane + a kind (obstacle vs pickup) and
 *     pull an instance from the right pool, parked at spawnZ ahead of the player;
 *   - each frame, scroll every active instance toward the player at the current
 *     world speed and recycle anything that passes despawnZ.
 *
 * It does NOT decide what a collision means - it just owns the active set and
 * exposes it (getActive) to the CollisionSystem, plus consume() so collisions can
 * remove a hit/collected object. Movement is driven from the GameManager loop (not
 * a per-object UpdateEvent) so spawn -> move -> collide always run in that order.
 */
import { GameConfig } from './GameConfig';
import { ObjectPool } from './ObjectPool';

export type SpawnKind = 'obstacle' | 'pickup';

export interface ActiveEntry {
  object: SceneObject;
  transform: Transform;
  lane: number;
  kind: SpawnKind;
}

@component
export class ObstacleSpawner extends BaseScriptComponent {
  @input
  obstaclePrefab: ObjectPrefab;
  @input
  pickupPrefab: ObjectPrefab;
  // Parent for spawned instances; the player should live in this same space so
  // the lane + z comparison in CollisionSystem is apples-to-apples.
  @input
  spawnRoot: SceneObject;

  private obstaclePool: ObjectPool;
  private pickupPool: ObjectPool;
  private active: ActiveEntry[] = [];
  private spawnTimer = 0;

  onAwake(): void {
    this.obstaclePool = new ObjectPool(
      this.obstaclePrefab,
      this.spawnRoot,
      GameConfig.poolSizeObstacles
    );
    this.pickupPool = new ObjectPool(
      this.pickupPrefab,
      this.spawnRoot,
      GameConfig.poolSizePickups
    );
  }

  /**
   * Game loop step. `speed` + `spawnInterval` come from the DifficultyCurve via
   * the GameManager, so the spawner stays ignorant of how difficulty is computed.
   */
  tickGame(dt: number, speed: number, spawnInterval: number): void {
    this.spawnTimer += dt;
    if (this.spawnTimer >= spawnInterval) {
      this.spawnTimer = 0;
      this.spawnOne();
    }
    this.advance(dt, speed);
  }

  private spawnOne(): void {
    var isPickup = Math.random() < GameConfig.pickupChance;
    var pool = isPickup ? this.pickupPool : this.obstaclePool;
    var lane = Math.floor(Math.random() * GameConfig.laneCount);

    var obj = pool.acquire();
    var tf = obj.getTransform();
    tf.setLocalPosition(new vec3(this.laneCenterX(lane), this.groundY(tf), GameConfig.spawnZ));

    this.active.push({
      object: obj,
      transform: tf,
      lane: lane,
      kind: isPickup ? 'pickup' : 'obstacle',
    });
  }

  private advance(dt: number, speed: number): void {
    // iterate backwards so we can splice recycled entries safely
    var i;
    for (i = this.active.length - 1; i >= 0; i -= 1) {
      var e = this.active[i];
      var p = e.transform.getLocalPosition();
      p.z += speed * dt; // scroll from spawnZ(negative) toward the player at z~0
      e.transform.setLocalPosition(p);
      if (p.z > GameConfig.despawnZ) {
        this.recycle(i);
      }
    }
  }

  /** The live obstacles/pickups - read by CollisionSystem each frame. */
  getActive(): ActiveEntry[] {
    return this.active;
  }

  /** Remove + pool-release a specific entry (a collision consumed it). */
  consume(entry: ActiveEntry): void {
    var i = this.active.indexOf(entry);
    if (i >= 0) {
      this.recycle(i);
    }
  }

  reset(): void {
    var i;
    for (i = 0; i < this.active.length; i += 1) {
      this.poolFor(this.active[i].kind).release(this.active[i].object);
    }
    this.active = [];
    this.spawnTimer = 0;
  }

  // ---- helpers -----------------------------------------------------------
  private recycle(index: number): void {
    var e = this.active[index];
    this.poolFor(e.kind).release(e.object);
    this.active.splice(index, 1);
  }

  private poolFor(kind: SpawnKind): ObjectPool {
    return kind === 'pickup' ? this.pickupPool : this.obstaclePool;
  }

  // lane centre in local X (mirrors PlayerController.laneX so they align)
  private laneCenterX(index: number): number {
    var mid = (GameConfig.laneCount - 1) / 2;
    return (index - mid) * GameConfig.laneWidth;
  }

  private groundY(tf: Transform): number {
    // keep whatever Y the prefab authored (its rest height); only X + Z are managed
    return tf.getLocalPosition().y;
  }
}
