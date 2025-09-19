(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const hudScore = document.getElementById('score');
  const hudLevel = document.getElementById('level');
  const hudLives = document.getElementById('lives');
  const hudStatus = document.getElementById('status');
  const startPanel = document.getElementById('start');
  const controlsPanel = document.getElementById('controls');
  const modal = document.getElementById('modal');
  const modalText = document.getElementById('modal-text');

  let width = 0, height = 0;
  const gridSize = 24;
  function resize() {
    width = canvas.width = Math.floor(window.innerWidth / 2) * 2;
    height = canvas.height = Math.floor(window.innerHeight / 2) * 2;
  }
  window.addEventListener('resize', resize);
  resize();

  const keys = new Set();
  window.addEventListener('keydown', (e) => {
    if (["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    if (e.code === 'Enter') maybeStart();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));

  const rand = (a, b) => a + Math.random() * (b - a);
  const choice = (arr) => arr[(Math.random() * arr.length) | 0];

  const world = {
    level: 1,
    score: 0,
    lives: 3,
    state: 'menu', // menu | playing | dead | gameover
    difficulty: 1,
  };

  const player = {
    x: 0,
    y: 0,
    speed: 280,
    radius: 10,
    fireCooldown: 0,
    baseFireRate: 220,
    bullets: [],
    bounds: { top: 0, bottom: 0 },
    power: {
      rapid: 0, spread: 0, shield: 0, slow: 0, pierce: 0,
      twin: 0, big: 0, magnet: 0, haste: 0, extra: 0,
      freeze: 0, bomb: 0
    },
  };

  const mushrooms = [];
  const centipedes = [];
  const pickups = [];

  function gridClampY(y) {
    const bottomZone = Math.floor(height - 6 * gridSize);
    if (y < gridSize) return gridSize;
    if (y > bottomZone) return bottomZone;
    return y;
  }

  function resetLevel() {
    mushrooms.length = 0;
    centipedes.length = 0;
    pickups.length = 0;
    // spawn mushrooms
    const cols = Math.floor(width / gridSize);
    const rows = Math.floor(height / gridSize) - 6;
    const density = 0.08 + world.level * 0.01;
    for (let r = 1; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() < density) {
          mushrooms.push({ x: c * gridSize + gridSize / 2, y: r * gridSize + gridSize / 2, hp: 3 });
        }
      }
    }

    // player
    player.x = width / 2;
    player.y = height - gridSize * 2.5;
    player.bullets.length = 0;
    player.fireCooldown = 0;

    // centipede
    const segs = 10 + Math.min(10, world.level * 2);
    const startY = gridSize * 1.5;
    const dir = 1;
    const segments = [];
    for (let i = 0; i < segs; i++) {
      segments.push({ x: gridSize * 2 + i * gridSize, y: startY, dir, turnCooldown: 0 });
    }
    centipedes.push({ segments, speed: 120 + world.level * 8 });

    // bounds
    player.bounds.top = height - gridSize * 6;
    player.bounds.bottom = height - gridSize * 0.8;
  }

  function maybeStart() {
    if (world.state === 'menu' || world.state === 'dead') {
      if (world.state === 'menu') {
        world.score = 0; world.lives = 3; world.level = 1; world.difficulty = 1;
      }
      startPanel.style.display = 'none';
      world.state = 'playing';
      resetLevel();
    }
  }

  function showModal(text, colorClass = 'glow-green', ms = 1100) {
    modalText.textContent = text;
    modalText.className = `modal-content ${colorClass}`;
    modal.classList.remove('hidden');
    clearTimeout(showModal._t);
    showModal._t = setTimeout(() => modal.classList.add('hidden'), ms);
  }

  function spawnPickup(x, y) {
    const types = [
      'rapid','spread','shield','slow','pierce','twin','big','magnet','haste','extra','freeze','bomb'
    ];
    const type = choice(types);
    const hue = {
      rapid: '#00e5ff', spread: '#ff00e5', shield: '#39ff14', slow: '#8fd3ff', pierce: '#ffd166',
      twin: '#ff6ad5', big: '#6df16d', magnet: '#a1c4fd', haste: '#fda1c4', extra: '#f9c74f',
      freeze: '#90e0ef', bomb: '#ef476f'
    }[type];
    pickups.push({ x, y, r: 10, vx: rand(-30,30), vy: rand(-10,-60), t: type, hue, life: 8000 });
  }

  function applyPowerUp(type) {
    player.power[type] = (player.power[type] || 0) + 1;
    const labels = {
      rapid: 'Rapid Fire', spread: 'Spread Shot', shield: 'Shield', slow: 'Slow Time', pierce: 'Piercing Shots',
      twin: 'Twin Cannons', big: 'Big Bullets', magnet: 'Magnet', haste: 'Haste', extra: 'Extra Life',
      freeze: 'Freeze Centipede', bomb: 'Bomb Shot'
    };
    if (type === 'extra') { world.lives += 1; }
    if (type === 'freeze') { freezeCentipedes(1800 + world.level * 100); }
    showModal(`Power-Up: ${labels[type]} (+${player.power[type]})`);
    updateHUD();
  }

  function freezeCentipedes(ms) {
    centipedes.forEach(c => c.frozenUntil = performance.now() + ms);
  }

  function updateHUD() {
    hudScore.textContent = `Score: ${world.score}`;
    hudLevel.textContent = `Level: ${world.level}`;
    hudLives.textContent = `Lives: ${world.lives}`;
  }

  function collidesCircle(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y; return dx*dx + dy*dy <= (a.r + b.r) * (a.r + b.r);
  }

  function rectPointBlock(px, py) {
    for (let i = 0; i < mushrooms.length; i++) {
      const m = mushrooms[i];
      if (Math.abs(px - m.x) < gridSize * 0.45 && Math.abs(py - m.y) < gridSize * 0.45) return m;
    }
    return null;
  }

  function step(dt) {
    if (world.state !== 'playing') return;

    // input
    const speed = player.speed * (player.power.haste ? 1.25 + 0.1 * (player.power.haste-1) : 1);
    let mx = 0, my = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) mx -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) mx += 1;
    if (keys.has('ArrowUp') || keys.has('KeyW')) my -= 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) my += 1;
    const len = Math.hypot(mx, my) || 1;
    const nextX = player.x + (mx/len) * speed * dt;
    const nextY = gridClampY(player.y + (my/len) * speed * dt);
    // block by mushrooms in player zone
    const block = rectPointBlock(nextX, nextY);
    if (!block) { player.x = nextX; player.y = nextY; }

    // shooting
    player.fireCooldown -= dt * 1000;
    const rateBoost = player.power.rapid ? Math.max(60, player.baseFireRate - 40 * player.power.rapid) : player.baseFireRate;
    if ((keys.has('Space') || keys.has('KeyJ')) && player.fireCooldown <= 0) {
      shoot();
      player.fireCooldown = rateBoost;
    }

    // update bullets
    for (let i = player.bullets.length - 1; i >= 0; i--) {
      const b = player.bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.life -= dt * 1000;
      if (b.y < 0 || b.life <= 0) { player.bullets.splice(i,1); continue; }
      const mh = rectPointBlock(b.x, b.y);
      if (mh) {
        // damage mushroom
        mh.hp -= (player.power.bomb ? 3 : 1);
        if (mh.hp <= 0) {
          world.score += 1;
          if (Math.random() < 0.18) spawnPickup(mh.x, mh.y);
          mushrooms.splice(mushrooms.indexOf(mh),1);
        }
        if (!player.power.pierce) player.bullets.splice(i,1);
        continue;
      }
      // collect pickup by shooting it
      let collected = false;
      for (let p = pickups.length - 1; p >= 0; p--) {
        const pk = pickups[p];
        if (Math.hypot(b.x - pk.x, b.y - pk.y) < (b.r + pk.r)) {
          applyPowerUp(pk.t);
          pickups.splice(p,1);
          collected = true;
          break;
        }
      }
      if (collected && !player.power.pierce) { player.bullets.splice(i,1); continue; }
      // hit centipede
      hitCentipede(b, i);
    }

    // update pickups
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.vy += 220 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= dt * 1000;
      if (p.life <= 0) { pickups.splice(i,1); continue; }
      // magnet
      if (player.power.magnet) {
        const dx = player.x - p.x, dy = player.y - p.y; const d = Math.hypot(dx,dy);
        const pull = Math.min(220 + 40 * (player.power.magnet-1), 500);
        p.vx += (dx / (d||1)) * pull * dt;
        p.vy += (dy / (d||1)) * pull * dt;
      }
      if (collidesCircle({x:player.x,y:player.y,r:player.radius+8}, {x:p.x,y:p.y,r:p.r})) {
        applyPowerUp(p.t);
        pickups.splice(i,1);
      }
    }

    // update centipedes
    for (let c = centipedes.length - 1; c >= 0; c--) {
      const cent = centipedes[c];
      const frozen = cent.frozenUntil && performance.now() < cent.frozenUntil;
      const s = frozen ? 10 : cent.speed * (player.power.slow ? 0.7 : 1);
      for (let i = 0; i < cent.segments.length; i++) {
        const seg = cent.segments[i];
        // horizontal move
        seg.x += seg.dir * s * dt;
        // screen edges
        if (seg.x < gridSize || seg.x > width - gridSize) {
          seg.x = Math.max(gridSize, Math.min(width - gridSize, seg.x));
          seg.dir *= -1; seg.y += gridSize;
        }
        // mushrooms cause turn and descend one row (classic behavior)
        const m = rectPointBlock(seg.x, seg.y);
        if (m && seg.turnCooldown <= 0) {
          seg.y += gridSize; seg.dir *= -1; seg.turnCooldown = 0.15;
        } else {
          seg.turnCooldown -= dt;
        }
        // check player collision in player zone
        if (seg.y > player.bounds.top - gridSize && Math.hypot(seg.x - player.x, seg.y - player.y) < gridSize * 0.6) {
          onPlayerHit(); return;
        }
        // bottom reached
        if (seg.y >= player.bounds.bottom) { onPlayerHit(); return; }
      }
      if (cent.segments.length === 0) centipedes.splice(c,1);
    }

    // win wave
    if (centipedes.length === 0) {
      world.level += 1; world.difficulty += 0.2; showModal(`Level ${world.level}`, 'glow-cyan', 900);
      resetLevel();
    }
    updateHUD();
  }

  function onPlayerHit() {
    if (player.power.shield > 0) {
      player.power.shield -= 1; showModal('Shield Absorbed!', 'glow-pink'); return;
    }
    world.lives -= 1; updateHUD();
    if (world.lives <= 0) {
      world.state = 'gameover';
      startPanel.style.display = 'block';
      startPanel.querySelector('.subtitle').textContent = 'Game Over - Press Enter';
    } else {
      world.state = 'dead';
      startPanel.style.display = 'block';
      startPanel.querySelector('.subtitle').textContent = 'Life Lost - Press Enter';
    }
  }

  function shoot() {
    const speed = 560 * (player.power.haste ? 1.05 + 0.05 * (player.power.haste-1) : 1);
    const base = { x: player.x, y: player.y - player.radius - 4, vx: 0, vy: -speed, r: player.power.big ? 6 + 1.2 * player.power.big : 4, life: 1400 };
    const bullets = [];
    if (player.power.spread) {
      const spreadCount = Math.min(5, 1 + player.power.spread);
      const angle = 0.35;
      for (let i = -Math.floor(spreadCount/2); i <= Math.floor(spreadCount/2); i++) {
        const b = { ...base, vx: Math.sin(i * angle) * speed * 0.45, vy: -Math.cos(i * angle) * speed };
        bullets.push(b);
      }
    } else {
      bullets.push({ ...base });
    }
    if (player.power.twin) {
      bullets.push({ ...base, x: player.x - 12 });
      bullets.push({ ...base, x: player.x + 12 });
    }
    if (player.power.bomb) {
      bullets.forEach(b => b.r += 2);
    }
    player.bullets.push(...bullets);
  }

  function hitCentipede(bullet, bulletIndex) {
    for (let c = 0; c < centipedes.length; c++) {
      const cent = centipedes[c];
      for (let i = 0; i < cent.segments.length; i++) {
        const seg = cent.segments[i];
        if (Math.hypot(bullet.x - seg.x, bullet.y - seg.y) < (bullet.r + gridSize * 0.35)) {
          // hit
          world.score += 5;
          if (Math.random() < 0.22) spawnPickup(seg.x, seg.y);
          // split
          const left = cent.segments.slice(0, i);
          const right = cent.segments.slice(i + 1);
          // mushroom spawns where segment dies (classic)
          mushrooms.push({ x: Math.round(seg.x / gridSize) * gridSize, y: Math.round(seg.y / gridSize) * gridSize, hp: 3 });
          // replace current centipede with one side and push other side as new
          cent.segments = left;
          if (right.length) centipedes.push({ segments: right, speed: cent.speed });
          if (!player.power.pierce) player.bullets.splice(bulletIndex,1);
          return true;
        }
      }
    }
    return false;
  }

  function draw() {
    ctx.clearRect(0,0,width,height);
    // neon vignette
    const g = ctx.createRadialGradient(width/2, height*0.9, 0, width/2, height*0.9, Math.max(width,height));
    g.addColorStop(0, 'rgba(0,229,255,0.06)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,width,height);

    // mushrooms
    mushrooms.forEach(m => {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.fillStyle = '#6cf';
      ctx.shadowColor = '#0ef'; ctx.shadowBlur = 10;
      const r = gridSize * 0.42;
      ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#0af'; ctx.beginPath(); ctx.arc(0, -r*0.2, r*0.7, Math.PI, 0); ctx.fill();
      ctx.restore();
    });

    // player
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fff'; ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(0, -14); ctx.lineTo(10, 10); ctx.lineTo(-10, 10); ctx.closePath();
    ctx.fill();
    if (player.power.shield) {
      ctx.strokeStyle = 'rgba(57,255,20,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0,0,18 + 2*player.power.shield,0,Math.PI*2); ctx.stroke();
    }
    ctx.restore();

    // bullets
    player.bullets.forEach(b => {
      ctx.save(); ctx.translate(b.x, b.y); ctx.fillStyle = '#f0f'; ctx.shadowColor = '#f0f'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(0,0,b.r,0,Math.PI*2); ctx.fill(); ctx.restore();
    });

    // centipedes
    centipedes.forEach(cent => {
      cent.segments.forEach((s, idx) => {
        ctx.save(); ctx.translate(s.x, s.y); const head = idx === cent.segments.length - 1;
        ctx.fillStyle = head ? '#0ff' : '#0f8'; ctx.shadowColor = head ? '#0ff' : '#39ff14'; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(0,0,gridSize*0.38,0,Math.PI*2); ctx.fill();
        // eyes
        if (head) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-5,-3,2,0,Math.PI*2); ctx.arc(5,-3,2,0,Math.PI*2); ctx.fill(); }
        ctx.restore();
      });
    });

    // pickups
    pickups.forEach(p => {
      ctx.save(); ctx.translate(p.x, p.y); ctx.fillStyle = p.hue; ctx.shadowColor = p.hue; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(0,0,p.r,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = '12px Segoe UI'; ctx.textAlign='center'; ctx.fillText(p.t.toUpperCase().slice(0,2), 0, 4);
      ctx.restore();
    });

    // player zone line
    ctx.strokeStyle = 'rgba(0,229,255,.25)'; ctx.setLineDash([6,6]); ctx.beginPath(); ctx.moveTo(0, player.bounds.top); ctx.lineTo(width, player.bounds.top); ctx.stroke(); ctx.setLineDash([]);
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    step(dt); draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // initial HUD
  updateHUD();
  controlsPanel.querySelector('.title').innerHTML = 'Controls';
})();
