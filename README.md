# Bitmoji Runner — a Lens Studio AR endless runner

A 3-lane endless runner for Snapchat / Lens Studio, starring the user's own
**Bitmoji**. Dodge and jump obstacles, grab pickups for points, survive as long
as you can. Three hits and it's over — then restart instantly, without ever
leaving the lens.

Built as a from-scratch prototype for the **Interactive AR Game Developer**
test task. The brief asked for a runner with a Bitmoji + animations, obstacles
to avoid, a 3-life fail state, an in-lens restart, a score with pickups, and a
difficulty ramp. All of that is here — but the thing I actually want you to read
is *how it's wired*, because the brief explicitly cares about clean,
maintainable, modular code. That's in **[ARCHITECTURE.md](ARCHITECTURE.md)**.

> New to Lens Studio? **[LENS_STUDIO_GUIDE.md](LENS_STUDIO_GUIDE.md)** is a
> from-zero walkthrough: install → new project → drop in the Bitmoji →
> wire the scripts → test → record → publish a Snapcode.

---

## What it does (against the brief)

| Requirement | How it's met |
|---|---|
| Bitmoji character with animations | `PlayerController` drives a `Bitmoji3DComponent` + `AnimationPlayer` — run / jump / hit / idle clips |
| Obstacles to dodge or jump over | `ObstacleSpawner` streams lane-aligned obstacles toward the player; tap to jump, swipe to switch lane |
| Lose a life on collision | `CollisionSystem` detects contact and emits `playerHit` |
| Game over after 3 hits | `GameManager` owns the life count; 0 lives → `gameOver` |
| Any control scheme | Touch: **tap = jump, swipe L/R = strafe** (`InputController`) |
| Restart without leaving the lens | The Restart button re-runs the same in-place reset path — no lens reload |
| Score + pickups + UI | `ScoreManager` (survival + pickups) → `UIController` paints score, lives, panels |
| Gets harder over time | `DifficultyCurve` ramps world speed and tightens spawn cadence every second |

---

## The shape of it (30-second version)

```
                 ┌──────────────────────────────────────────┐
                 │              GameManager                   │
                 │  state machine · lives · ONE game loop     │
                 └──────────────────────────────────────────┘
                  │ drives, in a fixed order, every frame:
                  ▼
   DifficultyCurve → ObstacleSpawner → CollisionSystem → ScoreManager → PlayerController
                                          │                   │              ▲
                                          │ emits             │ emits        │ commands
                                          ▼                   ▼              │
                          ┌───────────────────────────────────────┐   InputController
                          │     GameEvents  (typed pub/sub bus)     │   (tap / swipe)
                          └───────────────────────────────────────┘
                                          │ subscribes
                                          ▼
                                    UIController  (score · ♥♥♥ · panels)
```

Two communication styles, used deliberately:

- **Command (direct reference)** where one object literally drives another —
  Input → Player, GameManager → its systems. Calling these through an event bus
  would be obfuscation, not decoupling.
- **Notification (event bus)** for *"something happened, whoever cares can
  react"* — `playerHit`, `scoreChanged`, `pickupCollected`, `gameOver`. The
  spawner never imports the UI; the collision system never imports the score.
  Want to add sound on a life lost? Subscribe to `lifeLost` in a new file. You
  touch nothing that already works.

Full reasoning — including why there's **one** game loop instead of each
component binding its own `UpdateEvent`, and why collision is a manual lane+Z
test rather than the physics engine — is in **[ARCHITECTURE.md](ARCHITECTURE.md)**.

---

## Source layout

```
Assets/Scripts/
  GameConfig.ts        every designer-tunable number, one frozen object
  GameEvents.ts        typed publish/subscribe bus + payload interfaces
  ObjectPool.ts        generic prefab pool (no per-frame instantiate/destroy)
  DifficultyCurve.ts   elapsed-time → speed + spawn cadence (pure math)
  GameManager.ts       FSM + lives + the single ordered game loop
  PlayerController.ts   Bitmoji lane position, jump arc, animation clips
  InputController.ts    touch → jump / strafe commands
  ObstacleSpawner.ts    spawn · scroll · recycle obstacles & pickups (pooled)
  CollisionSystem.ts    lane + distance contact test → hit / pickup events
  ScoreManager.ts       survival + pickup scoring
  UIController.ts        score / lives / start / game-over panels
```

Every file opens with a comment explaining *why it exists and what it must not
do* — single-responsibility boundaries written down, not just implied.

---

## Tech & conventions

- **Lens Studio 5.x**, **TypeScript** (the modern `@component` Script API:
  `@input`, `@allowUndefined`, `BaseScriptComponent`, `createEvent`).
- **Frame-rate independent** — all motion is `position += speed * deltaTime`,
  so it plays the same on a fast phone and a slow one.
- **Zero per-frame allocation** in the steady state — obstacles and pickups are
  pooled and recycled.
- **All balancing in one file** (`GameConfig.ts`) — retune the whole game
  without reading a line of logic.

---

## Running it

1. Open Lens Studio 5.x and **open `BitmojiRunner/BitmojiRunner.esproj`** — the
   scene is pre-assembled: scripts imported and compiling, components attached,
   and the full gameplay graph wired (a placeholder capsule stands in for the
   Bitmoji).
2. Follow **[LENS_STUDIO_GUIDE.md](LENS_STUDIO_GUIDE.md)** for what remains — swap
   the capsule for your Bitmoji, build the score/lives UI, aim the camera, then
   test and publish.
3. Press the in-editor **Preview** (or pair the Snapchat app) to play.
4. **File → Publish** to push it live; Lens Studio gives you a **Snapcode** you
   can scan to open it on a phone.

> The TypeScript in `Assets/Scripts/` is the engineering artifact and is
> complete. Assembling the Lens Studio scene (the `.esproj`, the Bitmoji
> object, the two prefabs) is a few minutes of editor wiring documented
> step-by-step in the guide; once you do it once, commit the generated
> `.esproj` alongside these scripts and the repo clones-and-opens.

---

## Where I'd take it next

Out of scope for the test, but the architecture is already built to absorb them
without rewrites — each is a new subscriber or a new `GameConfig` block, not a
surgery:

- a **sound system** that subscribes to `pickupCollected` / `lifeLost`;
- **obstacle variety** — the collision test already reads a per-obstacle
  `clearHeight`, so "low hurdle you jump / tall barrier you dodge" is just a
  spawn-time number; a symmetric *slide-under* is the same idea inverted;
- a **near-miss bonus** read straight off the existing distance check;
- **haptics** and a **combo multiplier**, both pure subscribers.

That extensibility is the point of the decoupling, and it's the part of the
brief I most wanted to demonstrate.
