/**
 * GameConfig - every tunable in one place.
 *
 * Designer-facing numbers live here, not scattered through the systems, so the
 * game can be balanced without touching logic. Distances are in Lens Studio world
 * units (cm); times in seconds. Kept as a plain frozen object (no scene refs) so
 * any system can import it without coupling to the scene graph.
 */
export const GameConfig = {
  // ---- Lanes -------------------------------------------------------------
  // A 3-lane runner (left / centre / right). The player strafes between lanes;
  // obstacles + pickups spawn aligned to a lane so collision is a clean
  // lane + distance test (see CollisionSystem) rather than full physics.
  laneCount: 3,
  laneWidth: 60, // cm between lane centres
  laneSwitchTime: 0.14, // s for the strafe tween

  // ---- Lives -------------------------------------------------------------
  startingLives: 3, // task: "after 3 collisions the game ends"
  hitInvulnerability: 0.8, // s of i-frames after a hit (no double-counting one obstacle)

  // ---- Forward motion ----------------------------------------------------
  // The player stays put on screen; the WORLD scrolls toward them. baseSpeed is
  // the starting scroll speed; DifficultyCurve ramps it over time.
  baseSpeed: 320, // cm/s at t=0
  maxSpeed: 900, // cm/s ceiling
  speedRampPerSecond: 9, // cm/s added each second of play

  // ---- Spawning ----------------------------------------------------------
  spawnZ: -1400, // cm ahead of the player where things appear
  despawnZ: 200, // cm behind the player where things recycle
  baseSpawnInterval: 1.05, // s between spawns at t=0
  minSpawnInterval: 0.42, // s floor as difficulty climbs
  spawnIntervalRampPerSecond: 0.012, // s shaved off the interval each second
  pickupChance: 0.34, // probability a spawn is a points pickup vs an obstacle
  maxSpawnsPerFrame: 3, // bound the catch-up loop after a frame hitch

  // ---- Jump --------------------------------------------------------------
  jumpHeight: 70, // cm apex
  jumpDuration: 0.62, // s up-and-down (an obstacle passes under you within this)

  // ---- Scoring -----------------------------------------------------------
  pickupPoints: 25,
  distancePointsPerSecond: 10, // passive score for surviving

  // ---- Collision ---------------------------------------------------------
  hitDistanceZ: 55, // cm: how close in Z counts as "at the player"
  pickupRadius: 70, // cm: generous grab radius
  // Height profile: the player clears an obstacle by being at least this high
  // above the ground (i.e. mid-jump). Below jumpHeight, so a well-timed jump
  // clears it; a tall barrier would set a clearHeight above jumpHeight to force
  // a lane change instead. This is what makes "jump over vs. dodge" data, not a
  // hard-coded boolean (see CollisionSystem).
  obstacleClearHeight: 42, // cm

  // ---- Object pool -------------------------------------------------------
  poolSizeObstacles: 8,
  poolSizePickups: 6,
} as const;

export type GameConfigType = typeof GameConfig;
