# Create a **Centipede clone** in a **1980s neon arcade style**.

**Requirements:**

* Use **HTML, vanilla JavaScript, and CSS**, with the **`<canvas>` element** for rendering.
* Must run efficiently in a browser without external frameworks.
* Show **player controls** (movement + shooting) as an **on-screen overlay**.
* Show how to start the game in the **on-screen overlay**.
* Include at least **10 distinct power-ups** (e.g., rapid fire, shields, extra life, slowdown, spread shot, etc.).
* Power-ups are randomly generated from shooting centipede sections and mushrooms.
* Power-ups are **colored and animated** to stand out, and can be **stacked**.
* Power-ups are aquired when user shoots them.
* When a power-up is collected:

* Display a **modal overlay** describing what it does, for a short while, try not to block the view or disturb the players game experience.
* Resume gameplay once the modal is closed.
* Core gameplay should follow the **classic Centipede** loop:

  * Player at bottom, centipede winding down from the top.
  * Mushrooms as obstacles.
  * Segment splitting when shot.
  * Scoring and increasing difficulty.
  * Game over when player is hit.
  * Game over when centipede reaches bottom.
  * Game over when player runs out of lives.
  * If centipede is killed, spawn a new one snd increase difficulty.

**Deliverables:**

* A single runnable project with **HTML, JS, and CSS** files.
* Code should be efficient, structured, and not commented.
