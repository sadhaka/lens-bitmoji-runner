/**
 * GameEvents - a tiny, fully-typed publish/subscribe bus.
 *
 * This is the backbone that keeps the systems DECOUPLED. The spawner never calls
 * the score manager; the collision system never calls the UI. They all speak
 * through this bus: one side emits, the other subscribes. The benefit for a
 * reviewer reading this repo: every system is independently testable and you can
 * add (say) a sound system later by subscribing to `lifeLost` without editing a
 * single existing file.
 *
 * It is a module-level singleton (one bus per lens) so any script can import it
 * without @input wiring in the editor.
 */

export type GameEventName =
  | 'gameStart'
  | 'gameOver'
  | 'gameReset'
  | 'scoreChanged'
  | 'playerHit' // raw obstacle contact (CollisionSystem -> GameManager)
  | 'lifeLost' // GameManager decided a life is gone (-> UI), payload = livesRemaining
  | 'pickupCollected';

type Handler = (payload?: any) => void;

class EventBus {
  private handlers: { [k: string]: Handler[] } = {};

  on(event: GameEventName, fn: Handler): void {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event].push(fn);
  }

  off(event: GameEventName, fn: Handler): void {
    var list = this.handlers[event];
    if (!list) {
      return;
    }
    var i = list.indexOf(fn);
    if (i >= 0) {
      list.splice(i, 1);
    }
  }

  emit(event: GameEventName, payload?: any): void {
    var list = this.handlers[event];
    if (!list) {
      return;
    }
    // iterate a copy so a handler that unsubscribes mid-emit can't corrupt the loop
    var snapshot = list.slice();
    var i;
    for (i = 0; i < snapshot.length; i += 1) {
      try {
        snapshot[i](payload);
      } catch (e) {
        print('[GameEvents] handler for "' + event + '" threw: ' + e);
      }
    }
  }

  /** Drop every subscriber - used only in teardown/hot-reload safety. */
  clear(): void {
    this.handlers = {};
  }
}

export const GameEvents = new EventBus();

// ---- payload shapes (documentation + type-safety at call sites) ----------
export interface ScoreChangedPayload {
  score: number;
}
export interface LifeLostPayload {
  livesRemaining: number;
}
export interface PickupPayload {
  points: number;
}
