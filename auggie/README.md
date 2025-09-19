# Centipede - Neon Arcade

A classic Centipede clone built with HTML5 Canvas, vanilla JavaScript, and CSS with a 1980s neon arcade aesthetic.

## How to Play

1. Open `index.html` in a web browser
2. Press **Enter** to start the game
3. Use **Arrow Keys** to move your player
4. Press **Spacebar** to shoot
5. Destroy the centipede before it reaches the bottom!

## Game Features

- **Classic Centipede gameplay** with modern neon styling
- **12 unique power-ups** with stacking abilities:
  - Rapid Fire (R) - Faster shooting
  - Shield (S) - Temporary invincibility
  - Extra Life (L) - Gain an extra life
  - Time Slow (T) - Slows down centipedes
  - Multi-Shot (M) - Shoot multiple bullets
  - Piercing Shot (P) - Bullets go through enemies
  - Explosive Shot (E) - Bullets explode on impact
  - Magnet (G) - Attracts power-ups
  - Double Score (D) - Double points
  - Freeze (F) - Freezes all centipedes
  - Nuke (N) - Destroys all mushrooms
  - Speed Boost (B) - Move faster

- **Progressive difficulty** - Each level increases centipede speed and count
- **Scoring system** with bonus points for power-ups
- **Lives system** - Lose a life when hit or centipede reaches bottom
- **Mushroom obstacles** that block movement and can be destroyed
- **Centipede splitting** - Shooting middle segments creates two centipedes

## Files

- `index.html` - Main game page
- `style.css` - 1980s neon styling and animations
- `game.js` - Complete game logic and mechanics

## Technical Details

- Built with vanilla JavaScript (no frameworks)
- Uses HTML5 Canvas for efficient rendering
- Responsive design with neon glow effects
- Smooth 60fps gameplay with requestAnimationFrame
- Object-oriented game architecture