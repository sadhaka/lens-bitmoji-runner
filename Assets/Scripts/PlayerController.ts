/**
 * PlayerController - the Bitmoji runner.
 *
 * Owns the avatar's lane position, the jump arc, and which animation clip plays.
 * Deliberately "dumb" about game rules: it exposes jump()/moveLane() commands and
 * laneIndex/isAirborne state. InputController drives it; CollisionSystem reads it.
 * It never knows about score or lives.
 *
 * Motion is frame-independent (uses dt) and done with manual lerps rather than the
 * Tween Manager so the project has zero extra-prefab setup - a reviewer can clone,
 * open, and run it. (Tween Manager would be a drop-in alternative; see ARCHITECTURE.)
 */
import { GameConfig } from './GameConfig';

@component
export class PlayerController extends BaseScriptComponent {
  // The Bitmoji's AnimationPlayer (added on the Bitmoji 3D object). Optional so the
  // script still runs before the avatar is wired in the editor.
  @input
  @allowUndefined
  animationPlayer: AnimationPlayer;

  @input('string', 'run')
  runClip: string = 'run';
  @input('string', 'jump')
  jumpClip: string = 'jump';
  @input('string', 'hit')
  hitClip: string = 'hit';
  @input('string', 'idle')
  idleClip: string = 'idle';

  private tf: Transform;
  private laneIndex = 0; // set to centre in onAwake
  private baseY = 0;
  private isJumping = false;
  private jumpTimer = 0;

  onAwake(): void {
    this.tf = this.getTransform();
    this.laneIndex = Math.floor(GameConfig.laneCount / 2); // centre lane
    var p = this.tf.getLocalPosition();
    this.baseY = p.y;
    // snap to the centre lane immediately
    this.tf.setLocalPosition(new vec3(this.laneX(this.laneIndex), this.baseY, p.z));
  }

  // ---- commands (called by InputController) ------------------------------
  jump(): void {
    if (this.isJumping) {
      return;
    }
    this.isJumping = true;
    this.jumpTimer = 0;
    this.play(this.jumpClip, false);
  }

  moveLane(direction: number): void {
    var next = this.laneIndex + (direction < 0 ? -1 : 1);
    this.laneIndex = Math.max(0, Math.min(GameConfig.laneCount - 1, next));
  }

  // ---- lifecycle from the GameManager game loop --------------------------
  startRun(): void {
    this.play(this.runClip, true);
  }

  reset(): void {
    this.isJumping = false;
    this.jumpTimer = 0;
    this.laneIndex = Math.floor(GameConfig.laneCount / 2);
    this.tf.setLocalPosition(new vec3(this.laneX(this.laneIndex), this.baseY, this.tf.getLocalPosition().z));
    this.play(this.idleClip, true);
  }

  /** Advance lane-strafe + jump arc. Called each PLAYING frame by GameManager. */
  tickGame(dt: number): void {
    var p = this.tf.getLocalPosition();

    // strafe: ease current x toward the target lane x
    var targetX = this.laneX(this.laneIndex);
    var lerpT = Math.min(dt / GameConfig.laneSwitchTime, 1);
    var newX = p.x + (targetX - p.x) * lerpT;

    // jump: a simple parabola over jumpDuration
    var newY = this.baseY;
    if (this.isJumping) {
      this.jumpTimer += dt;
      var t = this.jumpTimer / GameConfig.jumpDuration;
      if (t >= 1) {
        this.isJumping = false;
        this.play(this.runClip, true);
      } else {
        // 4*h*t*(1-t) is a clean 0->h->0 arc
        newY = this.baseY + 4 * GameConfig.jumpHeight * t * (1 - t);
      }
    }

    this.tf.setLocalPosition(new vec3(newX, newY, p.z));
  }

  /** Play the recoil clip, then return to running. Called on a non-fatal hit. */
  playHitReaction(): void {
    this.play(this.hitClip, false);
    var ev = this.createEvent('DelayedCallbackEvent');
    ev.bind(() => this.play(this.runClip, true));
    ev.reset(0.4);
  }

  // ---- read-only state (for CollisionSystem) -----------------------------
  get currentLane(): number {
    return this.laneIndex;
  }
  get isAirborne(): boolean {
    return this.isJumping;
  }

  // ---- helpers -----------------------------------------------------------
  private laneX(index: number): number {
    var mid = (GameConfig.laneCount - 1) / 2;
    return (index - mid) * GameConfig.laneWidth;
  }

  private play(clip: string, _loop: boolean): void {
    if (this.animationPlayer && clip) {
      // playClip plays by name; clip loop/weight is configured on the clip asset
      this.animationPlayer.playClip(clip);
    }
  }
}
