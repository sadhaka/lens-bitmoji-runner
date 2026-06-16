/**
 * GameManager - the brain: state machine, lives, and the one game loop.
 *
 * Why one loop here instead of each system binding its own UpdateEvent: Lens
 * Studio does not guarantee the order multiple UpdateEvents fire in, and a runner
 * needs spawn -> move -> collide -> score in that exact order each frame. So this
 * is the single UpdateEvent and it calls the systems explicitly. Everything else
 * talks over the event bus.
 *
 * Lives live here (the task: 3 hits -> game over). Restart is just startGame()
 * again - it resets every system in place, so the lens never reloads.
 */
import { GameConfig } from './GameConfig';
import { GameEvents, LifeLostPayload } from './GameEvents';
import { DifficultyCurve } from './DifficultyCurve';
import { PlayerController } from './PlayerController';
import { ObstacleSpawner } from './ObstacleSpawner';
import { CollisionSystem } from './CollisionSystem';
import { ScoreManager } from './ScoreManager';

enum GameState {
  Ready,
  Playing,
  GameOver,
}

@component
export class GameManager extends BaseScriptComponent {
  @input player: PlayerController;
  @input spawner: ObstacleSpawner;
  @input collision: CollisionSystem;
  @input score: ScoreManager;

  private state: GameState = GameState.Ready;
  private lives = GameConfig.startingLives;
  private difficulty = new DifficultyCurve();
  private lastScore = 0;

  onAwake(): void {
    GameEvents.on('playerHit', () => this.onPlayerHit());
    var update = this.createEvent('UpdateEvent');
    update.bind((e) => this.onUpdate(e.getDeltaTime()));
  }

  /** Start OR restart - the same reset path, so "restart in-lens" is free. */
  startGame(): void {
    // 1) tear everything down to a clean slate
    GameEvents.emit('gameReset');
    this.spawner.reset();
    this.player.reset();

    // 2) arm a fresh run
    this.lives = GameConfig.startingLives;
    this.difficulty.start();
    this.state = GameState.Playing;
    this.player.startRun();

    // 3) announce (UI + input wake up)
    GameEvents.emit('gameStart');
  }

  private onUpdate(dt: number): void {
    if (this.state !== GameState.Playing) {
      return;
    }
    // the fixed, ordered game loop
    this.difficulty.tick(dt);
    this.spawner.tickGame(
      dt,
      this.difficulty.currentSpeed,
      this.difficulty.currentSpawnInterval
    );
    this.collision.check(dt);
    this.score.tickDistance(dt);
    this.player.tickGame(dt);
  }

  private onPlayerHit(): void {
    if (this.state !== GameState.Playing) {
      return;
    }
    this.lives -= 1;
    GameEvents.emit('lifeLost', { livesRemaining: this.lives } as LifeLostPayload);

    if (this.lives <= 0) {
      this.endGame();
    } else {
      this.player.playHitReaction();
    }
  }

  private endGame(): void {
    this.state = GameState.GameOver;
    this.lastScore = this.score.current;
    this.difficulty.stop();
    GameEvents.emit('gameOver');
  }

  /** Read by the UI for the game-over panel. */
  get finalScore(): number {
    return this.lastScore;
  }
}
