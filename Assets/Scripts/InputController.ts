/**
 * InputController - turns raw touch into game commands.
 *
 * One control scheme, two gestures (the task allows any scheme):
 *   - TAP      -> jump
 *   - SWIPE L/R -> strafe a lane
 *
 * Two correctness guards worth noting:
 *   1) It only records + processes touches while the game is PLAYING (gated by the
 *      gameStart/gameOver/gameReset events). Without this, the very tap that
 *      presses "Start" would also register as an in-game jump on touch-release.
 *   2) It pairs a touch by getTouchId(): the gesture is judged from the SAME
 *      finger's start and end, and a cancelled touch is ignored. This stops a
 *      second finger or a cancelled drag from producing a phantom move.
 *
 * It holds a direct @input reference to the PlayerController because input -> actor
 * is a genuine command relationship (not the kind of cross-system chatter the
 * event bus exists to remove).
 */
import { GameEvents, releaseOnDestroy } from './GameEvents';
import { PlayerController } from './PlayerController';

@component
export class InputController extends BaseScriptComponent {
  @input
  player: PlayerController;

  // fraction of screen width a horizontal move must exceed to count as a swipe
  @input('float', '0.12')
  swipeThreshold: number = 0.12;

  private active = false;
  private activeTouchId = -1;
  private startX = 0;
  private startY = 0;

  onAwake(): void {
    releaseOnDestroy(this, [
      GameEvents.on('gameStart', () => (this.active = true)),
      GameEvents.on('gameOver', () => this.deactivate()),
      GameEvents.on('gameReset', () => this.deactivate()),
    ]);

    var startEv = this.createEvent('TouchStartEvent');
    startEv.bind((e) => this.onTouchStart(e));
    var endEv = this.createEvent('TouchEndEvent');
    endEv.bind((e) => this.onTouchEnd(e));
  }

  private deactivate(): void {
    this.active = false;
    this.activeTouchId = -1;
  }

  private onTouchStart(e: TouchStartEvent): void {
    if (!this.active || this.activeTouchId !== -1) {
      return; // not playing, or already tracking a finger
    }
    this.activeTouchId = e.getTouchId();
    var p = e.getTouchPosition();
    this.startX = p.x;
    this.startY = p.y;
  }

  private onTouchEnd(e: TouchEndEvent): void {
    if (!this.active || !this.player) {
      return;
    }
    if (e.getTouchId() !== this.activeTouchId) {
      return; // a different finger than the one we started tracking
    }
    // ignore a touch the OS cancelled (guarded - not all versions expose it)
    if (e.isCancelled && e.isCancelled()) {
      this.activeTouchId = -1;
      return;
    }

    var p = e.getTouchPosition();
    var dx = p.x - this.startX;
    var dy = p.y - this.startY;
    this.activeTouchId = -1;

    if (Math.abs(dx) > this.swipeThreshold && Math.abs(dx) > Math.abs(dy)) {
      // horizontal swipe -> strafe (dx>0 is rightward on screen)
      this.player.moveLane(dx > 0 ? 1 : -1);
    } else {
      // anything else is a tap -> jump
      this.player.jump();
    }
  }
}
