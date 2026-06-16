/**
 * UIController - the only script that touches Text + panels.
 *
 * Pure subscriber: it listens on the event bus and paints. It never computes a
 * score or counts a life - it just reflects state. The Start/Restart buttons are
 * the one outbound path: they ask the GameManager to (re)start. Restart works
 * without leaving the lens (task requirement) because it just re-runs the same
 * startGame() reset path - no lens reload.
 */
import { GameConfig } from './GameConfig';
import {
  GameEvents,
  LifeLostPayload,
  ScoreChangedPayload,
  releaseOnDestroy,
} from './GameEvents';
import { GameManager } from './GameManager';

@component
export class UIController extends BaseScriptComponent {
  @input scoreText: Text;
  @input livesText: Text;
  @input @allowUndefined finalScoreText: Text;

  @input startPanel: SceneObject; // "tap to play" menu
  @input gameOverPanel: SceneObject;

  @input startButton: InteractionComponent;
  @input restartButton: InteractionComponent;

  @input gameManager: GameManager;

  onAwake(): void {
    releaseOnDestroy(this, [
      GameEvents.on('scoreChanged', (p: ScoreChangedPayload) => this.setScore(p.score)),
      GameEvents.on('lifeLost', (p: LifeLostPayload) => this.setLives(p.livesRemaining)),
      GameEvents.on('gameStart', () => this.onGameStart()),
      GameEvents.on('gameOver', () => this.onGameOver()),
      GameEvents.on('gameReset', () => this.onReset()),
    ]);

    if (this.startButton) {
      this.startButton.onTouchStart.add(() => this.gameManager.startGame());
    }
    if (this.restartButton) {
      this.restartButton.onTouchStart.add(() => this.gameManager.startGame());
    }

    this.showMenu();
  }

  private onGameStart(): void {
    this.setVisible(this.startPanel, false);
    this.setVisible(this.gameOverPanel, false);
    this.setScore(0);
    this.setLives(GameConfig.startingLives);
  }

  private onGameOver(): void {
    if (this.finalScoreText && this.gameManager) {
      this.finalScoreText.text = 'SCORE  ' + this.gameManager.finalScore;
    }
    this.setVisible(this.gameOverPanel, true);
  }

  private onReset(): void {
    this.setScore(0);
    this.setLives(GameConfig.startingLives);
    this.setVisible(this.gameOverPanel, false);
  }

  private showMenu(): void {
    this.setVisible(this.startPanel, true);
    this.setVisible(this.gameOverPanel, false);
    this.setScore(0);
    this.setLives(GameConfig.startingLives);
  }

  private setScore(score: number): void {
    if (this.scoreText) {
      this.scoreText.text = String(score);
    }
  }

  private setLives(lives: number): void {
    if (this.livesText) {
      // a row of hearts reads instantly in an AR lens
      var hearts = '';
      var i;
      for (i = 0; i < Math.max(lives, 0); i += 1) {
        hearts += '♥ ';
      }
      this.livesText.text = hearts.trim();
    }
  }

  private setVisible(obj: SceneObject, visible: boolean): void {
    if (obj) {
      obj.enabled = visible;
    }
  }
}
