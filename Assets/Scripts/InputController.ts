/**
 * InputController - turns raw touch into game commands.
 *
 * One control scheme, two gestures (the task allows any scheme):
 *   - TAP      -> jump
 *   - SWIPE L/R -> strafe a lane
 * Implemented from a single Touch start/end pair so a tap and a swipe can't both
 * fire for one finger-press. It only listens while the game is PLAYING (gated by
 * the gameStart/gameOver events), so taps on the menu never make the avatar jump.
 *
 * It holds a direct @input reference to the PlayerController because input -> actor
 * is a genuine command relationship (not the kind of cross-system chatter the
 * event bus exists to remove).
 */
import { GameEvents } from './GameEvents';
import { PlayerController } from './PlayerController';

@component
export class InputController extends BaseScriptComponent {
  @input
  player: PlayerController;

  // fraction of screen width a horizontal move must exceed to count as a swipe
  @input('float', '0.12')
  swipeThreshold: number = 0.12;

  private active = false;
  private startX = 0;
  private startY = 0;

  onAwake(): void {
    GameEvents.on('gameStart', () => (this.active = true));
    GameEvents.on('gameOver', () => (this.active = false));
    GameEvents.on('gameReset', () => (this.active = false));

    var startEv = this.createEvent('TouchStartEvent');
    startEv.bind((e) => this.onTouchStart(e));
    var endEv = this.createEvent('TouchEndEvent');
    endEv.bind((e) => this.onTouchEnd(e));
  }

  private onTouchStart(e: TouchStartEvent): void {
    var p = e.getTouchPosition();
    this.startX = p.x;
    this.startY = p.y;
  }

  private onTouchEnd(e: TouchEndEvent): void {
    if (!this.active || !this.player) {
      return;
    }
    var p = e.getTouchPosition();
    var dx = p.x - this.startX;
    var dy = p.y - this.startY;

    if (Math.abs(dx) > this.swipeThreshold && Math.abs(dx) > Math.abs(dy)) {
      // horizontal swipe -> strafe (dx>0 is rightward on screen)
      this.player.moveLane(dx > 0 ? 1 : -1);
    } else {
      // anything else is a tap -> jump
      this.player.jump();
    }
  }
}
