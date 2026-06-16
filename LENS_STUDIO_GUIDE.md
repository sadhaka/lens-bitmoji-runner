# Lens Studio guide — from zero to a published lens

This is written for someone who has **never opened Lens Studio**. It takes you
from installing the app to a Bitmoji running on your phone via a Snapcode. The
TypeScript is already written and lives in `Assets/Scripts/` — this guide is the
~30 minutes of editor assembly that turns those scripts into a playable lens.

Work top to bottom. Each section ends with a **✓ Checkpoint** so you know it
worked before moving on.

---

## 0. Install Lens Studio

1. Go to **ar.snap.com/download** and download **Lens Studio** (use **5.x** —
   the scripts use the modern TypeScript API).
2. Install and open it. Sign in with your Snapchat account (needed to use
   Bitmoji and to publish).

**✓ Checkpoint:** Lens Studio opens to a "Create Project" / template screen.

---

## 1. Create the project & learn the 4 panels

1. **New Project → Blank** (or the empty "Camera" template).
2. **File → Save As** → save it **inside this repo folder**, named
   `BitmojiRunner.esproj`. (Saving here means git can track the project file
   next to the scripts.)

You'll use four panels constantly — find them now:

| Panel | What it is |
|---|---|
| **Scene Hierarchy** (left) | The tree of objects in your scene. You add objects here. |
| **Inspector** (right) | Properties of whatever you select. This is where you wire scripts. |
| **Asset Browser** (bottom) | Files: scripts, meshes, textures, prefabs. |
| **Preview** (center) | Live play view. Has a ▶ and a ● record button. |

There's also a **Logger** panel (Window → Panels → Logger) — it shows `print()`
output. Keep it open while testing.

**✓ Checkpoint:** project saved as `BitmojiRunner.esproj` in this folder; you
can name all four panels.

---

## 2. Bring in the scripts

1. In the **Asset Browser**, right-click → **Import Files** (or just drag) and
   bring in **all 11 `.ts` files** from `Assets/Scripts/`.
   - Tip: keep them in a `Scripts` folder in the browser to stay tidy.
2. Lens Studio compiles TypeScript automatically. Watch the Logger — you want
   **no red compile errors**. (Green/info lines are fine.)

> If you see errors about `vec3`, `Text`, `AnimationPlayer`, etc., make sure
> you're on Lens Studio **5.x** — those are built-in globals there.

**✓ Checkpoint:** all 11 scripts imported, Logger shows no compile errors.

---

## 3. Add the Bitmoji (your runner)

1. Open the **Asset Library** (toolbar button, top of the window).
2. Search **"Bitmoji"** → add **Bitmoji 3D** (a.k.a. "Bitmoji Playground" assets
   / the 3D Bitmoji resource). This adds a Bitmoji object with a
   **`Bitmoji 3D Component`** and an **animation library**.
3. Drag the Bitmoji into the Scene Hierarchy if it isn't already there. Rename
   the object **`Player`**.
4. Select `Player`. In the Inspector, **+ Add Component → Animation Player**
   (if one isn't already attached).
5. Click the Animation Player's clip list. Bitmoji 3D ships a library of named
   animation clips. **Note the exact clip names** for a run-style, jump-style,
   hit/stumble-style, and idle-style animation (e.g. something like `run`,
   `jump`, `hit`, `idle` — names vary by the Bitmoji set you added).

**✓ Checkpoint:** a Bitmoji named `Player` is visible in Preview, with an
Animation Player component and at least one playable clip.

---

## 4. Position the camera so you see the lane

A runner looks *down a track*. The default camera looks straight ahead — nudge
it so it sits behind and slightly above the player:

1. Select the **Camera** in the Hierarchy.
2. In the Inspector → Transform, set roughly **Position `(0, 160, 320)`** and
   **Rotation `(-12, 0, 0)`** (degrees). Tweak in Preview until you can see the
   player and a stretch of track ahead.
3. Select `Player`, set its Transform position to **`(0, 0, 0)`**.

> Coordinate note: in Lens Studio, **−Z is "into the screen."** Obstacles spawn
> far ahead (`spawnZ = -1400`) and scroll toward the player at `z ≈ 0`. The
> camera above looks down −Z, so they come at you. This matches `GameConfig.ts`.

**✓ Checkpoint:** in Preview you see the Bitmoji from behind/above with empty
track stretching ahead.

---

## 5. Make the obstacle & pickup prefabs

These are the things you spawn. Keep them dead simple — a block and a coin.

**Obstacle:**
1. Scene Hierarchy → **+ → 3D Object → Cube** (or a Mesh primitive).
2. Rename it `Obstacle`. Scale it to about **`(40, 80, 40)`** so it's a knee-to-
   chest wall in one lane. Give it a bright material/color (Inspector → add a
   material).
3. Drag `Obstacle` from the Hierarchy **into the Asset Browser** → this creates a
   **Prefab** (an `ObjectPrefab`). Then **delete** the `Obstacle` from the scene
   (the spawner instantiates it from the prefab — you don't want one sitting in
   the scene).

**Pickup:**
4. Repeat with a **Sphere** (or a flattened cylinder = a coin). Rename `Pickup`,
   scale ~**`(30, 30, 30)`**, gold material. Drag to Asset Browser → prefab →
   delete from scene.

**Spawn root:**
5. Scene Hierarchy → **+ → Empty Object**, name it **`SpawnRoot`**, Transform at
   `(0,0,0)`. Spawned objects parent here so their lane+Z math lines up with the
   player.

**✓ Checkpoint:** two prefabs (`Obstacle`, `Pickup`) exist in the Asset Browser;
an empty `SpawnRoot` sits at the origin; neither prefab is left loose in the
scene.

---

## 6. Build the UI (score, lives, panels)

Lens Studio UI lives under an **Orthographic Camera** with **Screen Transform**
objects. A blank project usually already has an orthographic UI camera; if not,
add one (**+ → Camera**, set Render Target / type to Orthographic).

Create these as **Text** and empty objects under the UI camera
(**+ → Text** for text; **+ → Empty Object** for panels):

| Object | Type | Purpose |
|---|---|---|
| `ScoreText` | Text | top-center, shows the number |
| `LivesText` | Text | top-left, shows `♥ ♥ ♥` |
| `StartPanel` | Empty (with a child Text "TAP TO PLAY") | the menu shown at start |
| `StartButton` | the StartPanel (or a child) with an **Interaction Component** | tap to start |
| `GameOverPanel` | Empty (with child Texts "GAME OVER" + `FinalScoreText`) | shown on death |
| `FinalScoreText` | Text (child of GameOverPanel) | final score |
| `RestartButton` | GameOverPanel (or a child) with an **Interaction Component** | tap to restart |

To add a tappable button: select the object → **+ Add Component → Interaction
Component**. (That's what `UIController` calls `onTouchStart` on.)

**✓ Checkpoint:** you can see `ScoreText`, `LivesText`, and a "TAP TO PLAY"
panel overlaid on the Preview.

---

## 7. Attach the scripts & wire them up

This is the heart of it. Create one empty object to hold the brain, then attach
the gameplay scripts and fill in their slots.

### 7a. Attach the components
1. Scene Hierarchy → **+ → Empty Object**, name it **`Game`**.
2. Select `Game` → **+ Add Component → Script**, and choose `GameManager`.
   Repeat to add `ScoreManager`, `ObstacleSpawner`, `CollisionSystem`, and
   `UIController` to the **same `Game` object** (they can all live together).
3. Select `Player` → **+ Add Component → Script → `PlayerController`**, and again
   → **`InputController`**. (Player-related scripts live on the Player.)

> `GameConfig`, `GameEvents`, `ObjectPool`, `DifficultyCurve` are **helper
> modules, not components** — you do **not** attach them to objects. The other
> scripts `import` them. If Lens Studio shows them as attachable, just don't add
> them.

### 7b. Fill in the @input slots
Select each component and drag the right object into each slot in the Inspector.
The slot names match the script exactly:

**PlayerController** (on `Player`):
- `Animation Player` → the Player's Animation Player component.
- `runClip` / `jumpClip` / `hitClip` / `idleClip` → type the **exact clip names**
  you noted in step 3 (overwrite the defaults if your Bitmoji set names them
  differently).

**InputController** (on `Player`):
- `player` → the `PlayerController` component (drag the Player object in).

**ObstacleSpawner** (on `Game`):
- `obstaclePrefab` → the `Obstacle` prefab from the Asset Browser.
- `pickupPrefab` → the `Pickup` prefab.
- `spawnRoot` → the `SpawnRoot` object.

**CollisionSystem** (on `Game`):
- `spawner` → the `ObstacleSpawner` component.
- `player` → the `PlayerController` component.

**GameManager** (on `Game`):
- `player` → `PlayerController`
- `spawner` → `ObstacleSpawner`
- `collision` → `CollisionSystem`
- `score` → `ScoreManager`

**UIController** (on `Game`):
- `scoreText` → `ScoreText`, `livesText` → `LivesText`,
  `finalScoreText` → `FinalScoreText`
- `startPanel` → `StartPanel`, `gameOverPanel` → `GameOverPanel`
- `startButton` → the Interaction Component on `StartButton`
- `restartButton` → the Interaction Component on `RestartButton`
- `gameManager` → the `GameManager` component

> Rule of thumb: every slot that says a **component type** (PlayerController,
> Text, InteractionComponent…) wants you to drag the object that *has* that
> component; Lens Studio picks the component off it.

**✓ Checkpoint:** no slot in any Inspector is empty/red. (Empty optional slots
on `finalScoreText` are tolerated, but fill it for the full experience.)

---

## 8. Test it

1. Press **▶** in the Preview panel.
2. You should see the "TAP TO PLAY" panel. Click it (in Preview, a mouse click =
   a tap).
3. The Bitmoji starts running, obstacles stream toward you. **Click** to jump,
   **click-drag left/right** to strafe lanes.
4. Hit 3 obstacles → "GAME OVER" with your score → click Restart → it runs again
   without reloading.

Watch the **Logger** for any runtime errors. Common first-run fixes:
- *Bitmoji T-poses / no animation* → clip names in PlayerController don't match
  the library; recheck step 3 names.
- *Nothing spawns* → a prefab slot or `spawnRoot` is empty on ObstacleSpawner.
- *Score/lives don't update* → a Text slot is empty on UIController.
- *Obstacles fly past without hitting* → camera/player Z is off; the player must
  sit near `z = 0` (step 4).

**✓ Checkpoint:** full loop works in Preview — play, dodge, jump, die at 3 hits,
restart in place.

### Test on your actual phone (optional but recommended)
- Install **Snapchat** → open it → there's a **Lens Studio "Paired" / Send to
  Snapchat** flow in Lens Studio (toolbar **Send to → Snapchat**). It pushes the
  lens to your phone so you can play it in AR.

---

## 9. Record the demo & publish

The brief asks for both a **recording** and a **published lens with a Snapcode**.

**Recording:**
1. In the Preview panel, press the **●** record button, play a round, stop.
2. Lens Studio saves a video/gif. That's your screen-capture demo.

**Publish (gets you the Snapcode):**
1. Add a **Lens icon**: Project Info / Publish panel asks for a small icon image
   (a square PNG). Drop one in `Public/` and select it.
2. **File → Publish Lens** (or the **Publish** button). Fill in a lens name
   ("Bitmoji Runner"), hints ("Tap to jump, swipe to move"), and submit.
3. Snap reviews it (usually quick). Once **approved**, your **My Lenses** page
   (on lensstudio's web dashboard) shows the **Snapcode** + a shareable link.
   Scan the Snapcode in Snapchat to open the lens.

> Keep the lens under the **~4 MB** publish limit — the simple primitive
> obstacles + one Bitmoji keep you well under it.

**✓ Checkpoint:** you have (a) a recorded video and (b) a published lens with a
Snapcode/link to share with the recruiter.

---

## 10. Commit the assembled project

Once it plays, commit the project file so the repo clones-and-opens:

```
git add BitmojiRunner.esproj Assets/ Public/
git commit -m "Assemble Lens Studio scene: Bitmoji, prefabs, UI, wiring"
```

The `.gitignore` already excludes the machine-local Lens Studio folders
(`Cache/`, `Support/`, `BackUp/`, etc.), so only the meaningful project files
get committed.

---

## Quick reference: what connects to what

```
Player  (object)
 ├─ Bitmoji 3D Component
 ├─ Animation Player ............ run / jump / hit / idle clips
 ├─ PlayerController (script) ... animationPlayer + 4 clip names
 └─ InputController  (script) ... player = PlayerController

Game  (object)
 ├─ GameManager     ... player, spawner, collision, score
 ├─ ObstacleSpawner ... obstaclePrefab, pickupPrefab, spawnRoot
 ├─ CollisionSystem ... spawner, player
 ├─ ScoreManager
 └─ UIController    ... scoreText, livesText, finalScoreText,
                        startPanel, gameOverPanel,
                        startButton, restartButton, gameManager

SpawnRoot  (empty at origin) ..... parent for spawned obstacles/pickups
Obstacle / Pickup  (prefabs in Asset Browser, not in the scene)
ScoreText / LivesText / StartPanel / GameOverPanel / FinalScoreText  (UI)
```

If something's wrong, it's almost always an **empty @input slot** — go back to
step 7b and check every one.
