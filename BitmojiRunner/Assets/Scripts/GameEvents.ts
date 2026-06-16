/**
 * GameEvents - a tiny, fully-typed publish/subscribe bus.
 *
 * This is the backbone that keeps the systems DECOUPLED. The spawner never calls
 * the score manager; the collision system never calls the UI. They all speak
 * through this bus: one side emits, the other subscribes. The benefit: every
 * system is independently testable and you can add (say) a sound system later by
 * subscribing to `lifeLost` without editing a single existing file.
 *
 * It is a module-level singleton (one bus per lens) so any script can import it
 * without @input wiring.
 *
 * LIFECYCLE SAFETY (the Lens Studio gotcha): because the bus outlives any single
 * component, a component that subscribes in onAwake but never unsubscribes would
 * leak - on a Lens live-reload or camera swap the old (destroyed) component stays
 * referenced, firing twice and eventually throwing "object is destroyed". So
 * `on()` returns an unsubscribe handle, and `releaseOnDestroy()` wires those
 * handles to the component's OnDestroyEvent. Every subscriber in this project
 * uses that pattern.
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

/** Calling this removes the subscription it came from. */
export type Unsubscribe = () => void;

class EventBus {
  private handlers: { [k: string]: Handler[] } = {};

  /** Subscribe; returns a handle that unsubscribes exactly this registration. */
  on(event: GameEventName, fn: Handler): Unsubscribe {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event].push(fn);
    var self = this;
    return function () {
      self.off(event, fn);
    };
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

/**
 * Bind a set of unsubscribe handles to a component's destruction. Call once in
 * onAwake with everything the component subscribed to; when Lens Studio destroys
 * the component (lens end, live-reload, object removal) the bus releases its
 * references and can't fire into a dead component.
 */
export function releaseOnDestroy(
  script: BaseScriptComponent,
  releases: Unsubscribe[]
): void {
  var ev = script.createEvent('OnDestroyEvent');
  ev.bind(function () {
    var i;
    for (i = 0; i < releases.length; i += 1) {
      releases[i]();
    }
  });
}

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
