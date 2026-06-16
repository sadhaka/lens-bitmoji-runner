# Architecture & design decisions

This document is the *why*. The brief weighs "clean, maintainable, modular
code" heavily, so rather than leave the reasoning implicit in the source, it's
written down here — including the trade-offs I considered and the alternatives I
chose **against**, with the conditions under which I'd flip each call.

---

## 1. The core problem: order matters in a runner

A runner does four things every frame, and they have a hard ordering:

1. advance time / difficulty,
2. spawn and scroll obstacles,
3. test the player against them,
4. update score + the avatar.

If collision runs *before* the spawner has moved the obstacles, you test stale
positions and get phantom hits or missed ones. So frame order is not a detail —
it's a correctness requirement.

### Decision: one game loop, not many

Lens Studio lets every `ScriptComponent` bind its own `UpdateEvent`, but **it
does not guarantee the order those events fire in.** Relying on that order is a
classic source of intermittent, un-debuggable bugs.

So there is exactly **one** `UpdateEvent`, in `GameManager`, and it calls the
systems explicitly in the order above:

```ts
difficulty.tick(dt);
spawner.tickGame(dt, difficulty.currentSpeed, difficulty.currentSpawnInterval);
collision.check(dt);
score.tickDistance(dt);
player.tickGame(dt);
```

The ordering is now *visible in one place* and impossible to get wrong by
accident. Every other system exposes a plain `tick`/`check` method instead of
binding its own update. This is the single most important structural decision in
the project.

**Alternative considered:** per-component `UpdateEvent` with a priority/ordering
convention. Rejected — it spreads a global invariant across many files and
trusts an engine guarantee that doesn't exist.

---

## 2. Communication: command vs. notification

Two relationships exist in any game, and conflating them is how spaghetti
starts. I separated them on purpose:

### Direct references — for commands
When object A's job is *to drive* object B, A holds a typed `@input` reference to
B and calls its methods:

- `InputController → PlayerController` (a tap **is** a command to jump),
- `GameManager → {spawner, collision, score, player}` (the loop **is** the
  conductor).

Routing these through an event bus would hide a real, intentional dependency
behind indirection. That's obfuscation dressed up as decoupling.

### Event bus — for notifications
When something *happens* and zero-or-many unrelated systems might care, it goes
on the bus (`GameEvents.ts`):

| Event | Emitted by | Heard by |
|---|---|---|
| `playerHit` | CollisionSystem | GameManager (decrements a life) |
| `lifeLost` | GameManager | UIController (repaints hearts) |
| `pickupCollected` | CollisionSystem | ScoreManager (adds points) |
| `scoreChanged` | ScoreManager | UIController |
| `gameStart` / `gameOver` / `gameReset` | GameManager | UI, Input, Score, Collision |

The payoff is concrete: the spawner never imports the score manager, the
collision system never imports the UI. Each is independently understandable and
testable, and **a new feature is usually a new subscriber, not an edit to
existing code** (see "Extending it" below). The bus is a module-level singleton
so any script can `import { GameEvents }` without editor wiring, and `emit`
iterates a snapshot of handlers + try/catches each one, so a misbehaving
subscriber can't corrupt the dispatch loop or take down the frame.

**Alternative considered:** a global event bus for *everything*, including
commands. Rejected — it makes the call graph invisible and turns a simple
"who jumps the player?" into a bus-archaeology exercise.

---

## 3. Collision: manual lane + Z test, not the physics engine

This is the decision most worth defending, so here it is in full.

Lens Studio ships a real physics layer (`ColliderComponent` +
`Physics.WorldComponent`, with `onOverlapEnter` callbacks). I deliberately did
**not** use it. The runner uses a manual test in `CollisionSystem`: an entity
collides when it's **in the player's lane**, **within `hitDistanceZ` in Z**, and
(for obstacles) **the player isn't mid-jump**.

Why manual wins *for this game*:

- **Determinism.** The same inputs always produce the same hits. Physics overlap
  callbacks fire on the physics tick, reintroducing exactly the frame-ordering
  ambiguity that decision #1 exists to kill.
- **Zero scene setup.** No colliders, no collision matrix, no physics layers to
  configure per prefab. The repo clones, opens, and runs. For a reviewer, that
  matters.
- **It's readable and reviewable.** The entire collision rule is ~10 lines you
  can reason about and tune (`hitDistanceZ`, `pickupRadius` in `GameConfig`). A
  3-lane runner is a 1-D problem (which lane + how close in Z) — a 3-D physics
  solver is the wrong tool for a 1-D question.
- **Performance.** A handful of arithmetic comparisons per frame vs. a physics
  world stepping every frame.

The cost: it only models lane+distance, not arbitrary shapes. **When I'd switch
to `ColliderComponent`:** obstacles with irregular 3-D silhouettes, free 2-D
movement instead of discrete lanes, or rich physics responses (bouncing,
ragdoll). For *this* brief — lanes, jump-over, fixed shapes — manual is the
senior call, not a shortcut.

The invulnerability window (`hitInvulnerability`) is part of this system: after
a hit, a short i-frame timer prevents one obstacle from draining two lives across
consecutive frames before it scrolls past.

---

## 4. Object pooling, not instantiate/destroy

Endless runners spawn objects forever. Calling `prefab.instantiate()` and
destroying every frame churns memory and causes GC stutter on a phone —
unacceptable in an AR lens where the camera feed is already eating the budget.

`ObjectPool` pre-instantiates a fixed set up front, then `acquire()` enables a
hidden instance and `release()` disables it back to a free list. **Zero
allocation in the steady state.** Pool sizes (`poolSizeObstacles`,
`poolSizePickups`) live in `GameConfig`; the pool grows gracefully if ever
exhausted, but is sized so it won't be.

---

## 5. Motion: manual `dt` lerps, not the Tween package

The strafe and jump are hand-written and frame-rate independent:

- **Strafe:** `x += (targetX - x) * min(dt / laneSwitchTime, 1)` — an eased
  approach to the target lane.
- **Jump:** a clean parabola `y = baseY + 4·h·t·(1−t)` over `jumpDuration`
  (0 → apex → 0, no trig, no allocation).

I chose this over the **Tween Manager** package for the same clone-and-run
reason as collision: no extra package import, no tween-config prefabs, and the
exact motion is visible and tunable in `GameConfig`. The Tween package is a
clean drop-in alternative if a designer wanted to author easing curves in the
editor rather than in code — the `PlayerController` API (`jump()`, `moveLane()`)
wouldn't change, only the interpolation inside `tickGame`.

---

## 6. Config as data

`GameConfig.ts` is a single frozen object holding **every** tunable — lane
geometry, lives, speeds, ramp rates, spawn cadence, jump shape, scoring,
collision radii, pool sizes — with units documented inline (cm, seconds). No
magic numbers in logic. A designer can rebalance the entire game's feel without
reading a line of system code, and there's exactly one place a number can live,
so two systems can never disagree about (say) lane width. `PlayerController` and
`ObstacleSpawner` both derive lane X from the same `laneWidth`/`laneCount`, so
the avatar and the obstacles are guaranteed to align.

---

## 7. State machine + free restart

`GameManager` is a 3-state FSM: `Ready → Playing → GameOver`. The game loop only
runs in `Playing`; input only listens in `Playing`. The brief's "restart without
leaving the lens" falls out for free: **start and restart are the same code
path** (`startGame()`), which emits `gameReset` (every system clears itself),
re-arms a fresh run, and emits `gameStart`. Nothing reloads the lens; the player
taps Restart and is running again in the same frame budget.

---

## Extending it without breaking it

The decoupling isn't theoretical — here's what each likely next feature costs:

| Feature | Change required |
|---|---|
| Sound on pickup / hit | **New file**, subscribes to `pickupCollected` / `lifeLost`. Zero edits elsewhere. |
| Obstacle variety (jump vs. strafe) | Add a `kind`/`shape` to the spawn entry; the spawner and collision already key off per-entry data. |
| Combo multiplier | Lives entirely inside `ScoreManager`; emits the same `scoreChanged`. |
| Haptics on hit | **New file**, subscribes to `lifeLost`. |
| Power-ups (shield, slow-mo) | New subscriber + a `GameConfig` block; the difficulty curve already centralizes pace. |

Every row is *additive*. That's the test of whether the modularity is real, and
it's the part of this brief I most wanted to get right.
