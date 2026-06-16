/**
 * ObjectPool - a generic Lens Studio prefab pool.
 *
 * Endless runners spawn and destroy a LOT of objects. Instantiating/destroying
 * every frame churns memory and stutters on a phone. So we instantiate once up
 * front, then recycle: `acquire()` hands out a hidden instance and enables it;
 * `release()` disables it and returns it to the free list. Zero allocation in the
 * steady state.
 *
 * Not a ScriptComponent - just a plain helper the spawner owns, so it stays unit-
 * testable and free of scene-lifecycle concerns.
 */
export class ObjectPool {
  private free: SceneObject[] = [];
  private all: SceneObject[] = [];

  /**
   * @param prefab the ObjectPrefab to clone
   * @param parent  the SceneObject the instances are parented under
   * @param size    how many to pre-instantiate
   */
  constructor(
    private prefab: ObjectPrefab,
    private parent: SceneObject,
    size: number
  ) {
    var i;
    for (i = 0; i < size; i += 1) {
      this.grow();
    }
  }

  private grow(): SceneObject {
    var obj = this.prefab.instantiate(this.parent);
    obj.enabled = false;
    this.all.push(obj);
    this.free.push(obj);
    return obj;
  }

  /** Take an instance from the pool (grows the pool if exhausted) + enable it. */
  acquire(): SceneObject {
    var obj = this.free.length > 0 ? this.free.pop() : this.grow();
    // grow() also pushed to free; pop it back off so it is not double-handed-out
    if (this.free.length && this.free[this.free.length - 1] === obj) {
      this.free.pop();
    }
    obj.enabled = true;
    return obj;
  }

  /** Hand an instance back: disable + mark free for reuse. */
  release(obj: SceneObject): void {
    obj.enabled = false;
    if (this.free.indexOf(obj) === -1) {
      this.free.push(obj);
    }
  }

  /** Release every live instance (called on game reset). */
  releaseAll(): void {
    var i;
    for (i = 0; i < this.all.length; i += 1) {
      this.release(this.all[i]);
    }
  }
}
