const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const scoreLabel = document.getElementById("score");
const livesLabel = document.getElementById("lives");
const levelLabel = document.getElementById("level");
const statusBanner = document.getElementById("status-banner");
const powerupModal = document.getElementById("powerup-modal");
const powerupList = document.getElementById("powerup-list");
const tileSize = 20;
const cols = canvas.width / tileSize;
const rows = canvas.height / tileSize;
const playerZoneRow = rows - 5;
const inputState = { left: false, right: false, up: false, down: false, shoot: false };
let gameState = "ready";
let lastTimestamp = 0;
let score = 0;
let level = 1;
let lives = 3;
let centipedes = [];
let bullets = [];
let mushrooms = [];
let powerUps = [];
let activeEffects = [];
let effectStacks = {};
let freezeActive = false;
let scoreMultiplier = 1;
let centipedeSpeedFactor = 1;
const powerUpCatalog = [
    { type: "rapidFire", name: "Rapid Fire", description: "Shorter blaster cooldown", duration: 10, color: "#ff41ff" },
    { type: "spreadShot", name: "Spread Shot", description: "Extra arc shots", duration: 12, color: "#00f0ff" },
    { type: "shield", name: "Shield", description: "Absorb next hit", duration: 0, color: "#f8ff2e" },
    { type: "extraLife", name: "Extra Life", description: "Gain one life", duration: 0, color: "#ff8e3c" },
    { type: "slowField", name: "Slow Field", description: "Centipede slowed", duration: 9, color: "#00ff9a" },
    { type: "speedBoost", name: "Velocity Boost", description: "Move faster", duration: 8, color: "#8a7bff" },
    { type: "piercing", name: "Piercing", description: "Shots pierce enemies", duration: 11, color: "#ff5f7a" },
    { type: "scoreBoost", name: "Score Surge", description: "Bonus points", duration: 14, color: "#57fffa" },
    { type: "shroomBomb", name: "Shroom Burst", description: "Blast mushrooms", duration: 0, color: "#ffdd57" },
    { type: "timeFreeze", name: "Time Lock", description: "Freeze centipede", duration: 5, color: "#7bff9f" }
];
const powerUpMap = {};
powerUpCatalog.forEach(def => {
    powerUpMap[def.type] = def;
});
function colorWithAlpha(hex, alpha) {
    const clean = hex.replace("#", "");
    const bigint = parseInt(clean, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
}
class Player {
    constructor() {
        this.width = tileSize;
        this.height = tileSize;
        this.baseSpeed = 220;
        this.baseCooldown = 0.35;
        this.bulletSpeed = 520;
        this.reset();
    }
    reset() {
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - tileSize * 2;
        this.cooldown = 0;
        this.shieldCharges = 0;
        this.modifiers = { speed: 1, cooldown: 1, spread: 0, piercing: 0 };
    }
    update(delta) {
        const speed = this.baseSpeed * this.modifiers.speed;
        let dx = 0;
        let dy = 0;
        if (inputState.left) dx -= 1;
        if (inputState.right) dx += 1;
        if (inputState.up) dy -= 1;
        if (inputState.down) dy += 1;
        if (dx !== 0 && dy !== 0) {
            const inv = 1 / Math.sqrt(2);
            dx *= inv;
            dy *= inv;
        }
        this.x += dx * speed * delta;
        this.y += dy * speed * delta;
        const minY = tileSize * playerZoneRow;
        const maxY = canvas.height - this.height;
        if (this.x < 0) this.x = 0;
        if (this.x > canvas.width - this.width) this.x = canvas.width - this.width;
        if (this.y < minY) this.y = minY;
        if (this.y > maxY) this.y = maxY;
        if (this.cooldown > 0) this.cooldown -= delta;
    }
    tryShoot() {
        if (this.cooldown > 0) return;
        const cooldown = this.baseCooldown * this.modifiers.cooldown;
        this.cooldown = cooldown;
        const centerX = this.x + this.width / 2;
        const shotY = this.y;
        bullets.push(new Bullet(centerX, shotY, 0, -this.bulletSpeed, this.modifiers.piercing));
        if (this.modifiers.spread > 0) {
            const count = Math.min(2, this.modifiers.spread);
            const angle = 0.4;
            for (let i = 0; i < count; i++) {
                const direction = i === 0 ? -1 : 1;
                const vx = Math.sin(angle * direction) * this.bulletSpeed;
                const vy = -Math.cos(angle * direction) * this.bulletSpeed;
                bullets.push(new Bullet(centerX, shotY, vx, vy, this.modifiers.piercing));
            }
        }
    }
    draw() {
        const baseX = this.x + this.width / 2;
        const baseY = this.y + this.height;
        ctx.save();
        ctx.fillStyle = "rgba(0,240,255,0.85)";
        ctx.beginPath();
        ctx.moveTo(baseX, this.y + 4);
        ctx.lineTo(this.x + 4, baseY - 4);
        ctx.lineTo(this.x + this.width - 4, baseY - 4);
        ctx.closePath();
        ctx.fill();
        if (this.shieldCharges > 0) {
            const shieldGradient = ctx.createRadialGradient(baseX, this.y + this.height / 2, this.width / 4, baseX, this.y + this.height / 2, this.width);
            shieldGradient.addColorStop(0, colorWithAlpha("#ffffff", 0.15));
            shieldGradient.addColorStop(1, colorWithAlpha("#f8ff2e", 0.6));
            ctx.fillStyle = shieldGradient;
            ctx.beginPath();
            ctx.ellipse(baseX, this.y + this.height / 2, this.width, this.height, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = colorWithAlpha("#f8ff2e", 0.4 + this.shieldCharges * 0.1);
            ctx.lineWidth = 2 + this.shieldCharges;
            ctx.beginPath();
            ctx.ellipse(baseX, this.y + this.height / 2, this.width, this.height, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }
}
class Bullet {
    constructor(x, y, vx, vy, piercing) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = 4;
        this.piercing = Math.max(0, Math.floor(piercing));
        this.active = true;
    }
    update(delta) {
        this.x += this.vx * delta;
        this.y += this.vy * delta;
        if (this.y < -20 || this.y > canvas.height + 20 || this.x < -20 || this.x > canvas.width + 20) this.active = false;
    }
    draw() {
        const gradient = ctx.createLinearGradient(this.x, this.y - 10, this.x, this.y + 10);
        gradient.addColorStop(0, "rgba(255,65,255,0.9)");
        gradient.addColorStop(1, "rgba(0,240,255,0.9)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.radius, this.radius * 1.9, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}
class Mushroom {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.health = 3;
        this.phase = Math.random() * Math.PI * 2;
    }
    draw(delta) {
        this.phase += delta * 3;
        const px = this.x * tileSize + tileSize / 2;
        const py = this.y * tileSize + tileSize / 2;
        const glow = (Math.sin(this.phase) + 1) * 0.4 + 0.4;
        ctx.fillStyle = colorWithAlpha("#ff8dfe", glow);
        ctx.beginPath();
        ctx.arc(px, py, tileSize * 0.36, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = colorWithAlpha("#ffffff", 0.4 + glow * 0.2);
        ctx.beginPath();
        ctx.arc(px, py - 3, tileSize * 0.22, 0, Math.PI * 2);
        ctx.fill();
    }
}
class Centipede {
    constructor(length, speed, startRow, direction, segments) {
        this.speed = speed;
        this.direction = direction || 1;
        this.moveProgress = 0;
        if (segments) {
            this.segments = segments.map(seg => ({ x: seg.x, y: seg.y }));
        } else {
            this.segments = [];
            const startCol = Math.floor(cols / 2);
            for (let i = 0; i < length; i++) {
                this.segments.push({ x: startCol - i * this.direction, y: startRow });
            }
        }
        this.reachedBottom = false;
    }
    update(delta) {
        this.moveProgress += delta * this.speed;
        while (this.moveProgress >= 1) {
            this.step();
            this.moveProgress -= 1;
        }
    }
    step() {
        const currentHead = this.segments[0];
        const nextHead = { x: currentHead.x + this.direction, y: currentHead.y };
        let blocked = nextHead.x < 0 || nextHead.x >= cols || !!getMushroomAt(nextHead.x, nextHead.y);
        if (blocked) {
            nextHead.x = currentHead.x;
            nextHead.y += 1;
            this.direction *= -1;
            let safety = 0;
            while (getMushroomAt(nextHead.x, nextHead.y) && safety < 8) {
                nextHead.y += 1;
                safety += 1;
            }
        }
        if (nextHead.y >= rows) nextHead.y = rows - 1;
        const previous = this.segments.map(seg => ({ x: seg.x, y: seg.y }));
        this.segments[0] = nextHead;
        for (let i = 1; i < this.segments.length; i++) {
            this.segments[i] = previous[i - 1];
        }
        if (nextHead.y >= rows - 1) this.reachedBottom = true;
    }
    draw(time) {
        const baseTime = time % 360;
        for (let i = 0; i < this.segments.length; i++) {
            const seg = this.segments[i];
            const px = seg.x * tileSize + tileSize / 2;
            const py = seg.y * tileSize + tileSize / 2;
            const hue = (i * 28 + baseTime) % 360;
            ctx.fillStyle = "hsl(" + hue + ", 100%, 60%)";
            ctx.beginPath();
            ctx.arc(px, py, tileSize * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "hsla(" + hue + ", 100%, 80%, 0.7)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(px, py, tileSize * 0.48, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}
class PowerUpOrb {
    constructor(type, x, y, color) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.vy = 30;
        this.radius = tileSize * 0.36;
        this.phase = Math.random() * Math.PI * 2;
        this.color = color;
        this.active = true;
    }
    update(delta) {
        this.phase += delta * 6;
        this.y += this.vy * delta;
        this.vy += 30 * delta;
        if (this.y > canvas.height - tileSize * 1.5) {
            this.y = canvas.height - tileSize * 1.5;
            this.vy *= -0.55;
        }
        if (Math.abs(this.vy) < 8) this.vy += 8 * Math.sign(this.vy || 1);
    }
    draw() {
        const pulse = 0.75 + Math.sin(this.phase) * 0.18;
        ctx.save();
        ctx.shadowBlur = 18;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.85 + Math.sin(this.phase * 2) * 0.08;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = colorWithAlpha("#ffffff", 0.8);
        ctx.beginPath();
        ctx.arc(this.x, this.y - this.radius * 0.3, this.radius * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}
const player = new Player();
function updateLabels() {
    scoreLabel.textContent = "Score: " + score;
    livesLabel.textContent = "Lives: " + lives;
    levelLabel.textContent = "Level: " + level;
}
function setStatus(text) {
    statusBanner.textContent = text;
}
function clearEffects() {
    activeEffects = [];
    effectStacks = {};
    freezeActive = false;
    scoreMultiplier = 1;
    centipedeSpeedFactor = 1;
    recalcModifiers();
    updatePowerupHud();
}
function recalcModifiers() {
    player.modifiers.speed = 1 + 0.25 * (effectStacks.speedBoost || 0);
    const rapid = effectStacks.rapidFire || 0;
    player.modifiers.cooldown = Math.pow(0.75, rapid);
    if (player.modifiers.cooldown < 0.3) player.modifiers.cooldown = 0.3;
    player.modifiers.spread = Math.min(2, effectStacks.spreadShot || 0);
    player.modifiers.piercing = Math.min(3, effectStacks.piercing || 0);
    scoreMultiplier = 1 + 0.5 * (effectStacks.scoreBoost || 0);
    const slow = effectStacks.slowField || 0;
    centipedeSpeedFactor = slow > 0 ? Math.max(0.35, 1 - 0.25 * slow) : 1;
    freezeActive = (effectStacks.timeFreeze || 0) > 0;
}
function addEffect(type, duration) {
    if (duration > 0) {
        const expiresAt = performance.now() + duration * 1000;
        activeEffects.push({ type: type, expiresAt: expiresAt });
    }
    effectStacks[type] = (effectStacks[type] || 0) + 1;
    recalcModifiers();
    updatePowerupHud();
}
function removeEffect(type) {
    if (!effectStacks[type]) return;
    effectStacks[type] -= 1;
    if (effectStacks[type] <= 0) delete effectStacks[type];
    recalcModifiers();
    updatePowerupHud();
}
function updateEffects(now) {
    let changed = false;
    for (let i = activeEffects.length - 1; i >= 0; i--) {
        if (now >= activeEffects[i].expiresAt) {
            const type = activeEffects[i].type;
            activeEffects.splice(i, 1);
            removeEffect(type);
            changed = true;
        }
    }
    if (changed) updatePowerupHud();
}
function updatePowerupHud() {
    powerupList.innerHTML = "";
    const now = performance.now();
    const summary = {};
    for (const entry of activeEffects) {
        if (!summary[entry.type]) summary[entry.type] = { stacks: 0, time: 0 };
        const remaining = Math.max(0, (entry.expiresAt - now) / 1000);
        if (remaining > summary[entry.type].time) summary[entry.type].time = remaining;
        summary[entry.type].stacks += 1;
    }
    powerUpCatalog.forEach(def => {
        if (!summary[def.type]) return;
        const chip = document.createElement("div");
        chip.className = "powerup-chip";
        chip.textContent = def.name + " " + summary[def.type].stacks + "× " + summary[def.type].time.toFixed(1) + "s";
        powerupList.appendChild(chip);
    });
}
function showModal(type) {
    const info = powerUpMap[type];
    if (!info) return;
    powerupModal.innerHTML = "<span class=\"name\">" + info.name + "</span><span class=\"detail\">" + info.description + "</span>";
    powerupModal.classList.add("active");
    clearTimeout(showModal.timer);
    showModal.timer = setTimeout(function () {
        powerupModal.classList.remove("active");
    }, 1800);
}
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function spawnMushroom(x, y) {
    if (y >= rows) return;
    if (getMushroomAt(x, y)) return;
    mushrooms.push(new Mushroom(x, y));
}
function sproutMushrooms(count) {
    for (let i = 0; i < count; i++) {
        const x = randomInt(0, cols - 1);
        const y = randomInt(2, rows - 6);
        if (!getMushroomAt(x, y)) mushrooms.push(new Mushroom(x, y));
    }
}
function spawnMushroomField() {
    mushrooms = [];
    sproutMushrooms(28 + level * 4);
}
function getMushroomAt(x, y) {
    return mushrooms.find(m => m.x === x && m.y === y);
}
function damageMushroom(mushroom) {
    mushroom.health -= 1;
    if (mushroom.health <= 0) {
        const index = mushrooms.indexOf(mushroom);
        if (index >= 0) mushrooms.splice(index, 1);
        if (Math.random() < 0.25) spawnPowerUp(mushroom.x * tileSize + tileSize / 2, mushroom.y * tileSize + tileSize / 2);
        addScore(5);
    }
}
function spawnPowerUp(x, y) {
    const pick = powerUpCatalog[randomInt(0, powerUpCatalog.length - 1)];
    powerUps.push(new PowerUpOrb(pick.type, x, y, pick.color));
}
function collectPowerUp(type) {
    const info = powerUpMap[type];
    if (!info) return;
    if (type === "extraLife") {
        lives += 1;
    } else if (type === "shield") {
        player.shieldCharges = Math.min(player.shieldCharges + 1, 3);
    } else if (type === "shroomBomb") {
        const removals = Math.min(6, mushrooms.length);
        for (let i = 0; i < removals; i++) {
            const index = Math.floor(Math.random() * mushrooms.length);
            mushrooms.splice(index, 1);
        }
        addScore(25 * removals);
    } else {
        addEffect(type, info.duration);
    }
    showModal(type);
    updateLabels();
}
function addScore(value) {
    score += Math.floor(value * scoreMultiplier);
    updateLabels();
}
function spawnCentipede() {
    const baseLength = Math.min(12 + Math.floor(level / 2), 18);
    const speed = 3 + level * 0.65;
    centipedes.push(new Centipede(baseLength, speed, 0, 1));
}
function resetLevel(resetMushrooms, clearEffectsFlag) {
    bullets = [];
    powerUps = [];
    if (clearEffectsFlag) clearEffects();
    if (resetMushrooms) spawnMushroomField();
    centipedes = [];
    spawnCentipede();
}
function checkCentipedeCollisions() {
    for (let c = centipedes.length - 1; c >= 0; c--) {
        const centipede = centipedes[c];
        for (let i = 0; i < centipede.segments.length; i++) {
            const seg = centipede.segments[i];
            const segRect = {
                x: seg.x * tileSize + tileSize * 0.2,
                y: seg.y * tileSize + tileSize * 0.2,
                w: tileSize * 0.6,
                h: tileSize * 0.6
            };
            if (intersects(segRect, { x: player.x, y: player.y, w: player.width, h: player.height })) {
                if (player.shieldCharges > 0) {
                    player.shieldCharges -= 1;
                    splitCentipedeSegment(centipede, i, true);
                    addScore(40);
                } else {
                    handlePlayerHit();
                    return;
                }
            }
        }
        if (centipede.reachedBottom) {
            handlePlayerHit();
            return;
        }
    }
}
function intersects(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function handlePlayerHit() {
    lives -= 1;
    updateLabels();
    if (lives <= 0) {
        gameOver();
    } else {
        setStatus("Life lost. Respawning...");
        player.reset();
        resetLevel(false, true);
    }
}
function gameOver() {
    gameState = "gameover";
    setStatus("Game Over. Press Enter to restart.");
}
function nextLevel() {
    level += 1;
    setStatus("Level " + level);
    resetLevel(false, false);
    sproutMushrooms(6 + level * 2);
    updateLabels();
}
function splitCentipedeSegment(centipede, index, skipMushroom) {
    const segment = centipede.segments[index];
    if (!segment) return;
    if (!skipMushroom) spawnMushroom(segment.x, segment.y);
    if (Math.random() < 0.35) spawnPowerUp(segment.x * tileSize + tileSize / 2, segment.y * tileSize + tileSize / 2);
    addScore(60);
    if (index === 0) {
        centipede.segments.shift();
        centipede.reachedBottom = false;
    } else {
        const trailing = centipede.segments.slice(index + 1);
        centipede.segments = centipede.segments.slice(0, index);
        centipede.reachedBottom = false;
        if (trailing.length > 0) {
            centipedes.push(new Centipede(trailing.length, centipede.speed + 0.4, trailing[0].y, centipede.direction, trailing));
        }
    }
    if (centipede.segments.length === 0) {
        const idx = centipedes.indexOf(centipede);
        if (idx >= 0) centipedes.splice(idx, 1);
    }
}
function updateBullets(delta) {
    for (const bullet of bullets) bullet.update(delta);
    bullets = bullets.filter(b => b.active);
}
function handleBulletHits() {
    for (const bullet of bullets) {
        if (!bullet.active) continue;
        let hit = false;
        const gridX = Math.floor(bullet.x / tileSize);
        const gridY = Math.floor(bullet.y / tileSize);
        const mushroom = getMushroomAt(gridX, gridY);
        if (mushroom) {
            damageMushroom(mushroom);
            hit = true;
        }
        if (!hit) {
            for (let c = 0; c < centipedes.length; c++) {
                const centipede = centipedes[c];
                let segmentHit = false;
                for (let s = 0; s < centipede.segments.length; s++) {
                    const seg = centipede.segments[s];
                    const segX = seg.x * tileSize + tileSize / 2;
                    const segY = seg.y * tileSize + tileSize / 2;
                    const distSq = (bullet.x - segX) * (bullet.x - segX) + (bullet.y - segY) * (bullet.y - segY);
                    if (distSq <= (tileSize * 0.4) * (tileSize * 0.4)) {
                        splitCentipedeSegment(centipede, s, false);
                        segmentHit = true;
                        hit = true;
                        break;
                    }
                }
                if (segmentHit) break;
            }
        }
        if (!hit) {
            for (const orb of powerUps) {
                if (!orb.active) continue;
                const dist = Math.hypot(bullet.x - orb.x, bullet.y - orb.y);
                if (dist < orb.radius) {
                    orb.active = false;
                    collectPowerUp(orb.type);
                    hit = true;
                    break;
                }
            }
        }
        if (hit) {
            if (bullet.piercing > 0) {
                bullet.piercing -= 1;
            } else {
                bullet.active = false;
            }
        }
    }
    bullets = bullets.filter(b => b.active);
}
function updatePowerUps(delta) {
    for (const orb of powerUps) {
        if (!orb.active) continue;
        orb.update(delta);
        const dist = Math.hypot(player.x + player.width / 2 - orb.x, player.y + player.height / 2 - orb.y);
        if (dist < tileSize * 0.6) {
            orb.active = false;
            collectPowerUp(orb.type);
        }
    }
    powerUps = powerUps.filter(p => p.active);
}
function updateCentipedes(delta) {
    for (const centipede of centipedes) {
        if (freezeActive) continue;
        centipede.update(delta * centipedeSpeedFactor);
    }
}
function drawGridOverlay() {
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += tileSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += tileSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}
function render(delta) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    drawGridOverlay();
    for (const mushroom of mushrooms) mushroom.draw(delta);
    const time = performance.now() * 0.05;
    for (const centipede of centipedes) centipede.draw(time);
    for (const orb of powerUps) orb.draw();
    for (const bullet of bullets) bullet.draw();
    player.draw();
    ctx.restore();
    if (gameState === "ready") {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(canvas.width / 2 - 160, canvas.height / 2 - 60, 320, 120);
        ctx.strokeStyle = "rgba(0,240,255,0.7)";
        ctx.strokeRect(canvas.width / 2 - 160, canvas.height / 2 - 60, 320, 120);
        ctx.fillStyle = "#00f0ff";
        ctx.font = "20px 'Segoe UI'";
        ctx.textAlign = "center";
        ctx.fillText("Press Enter to Start", canvas.width / 2, canvas.height / 2 - 10);
        ctx.fillStyle = "#ff41ff";
        ctx.font = "16px 'Segoe UI'";
        ctx.fillText("Shoot the neon centipede", canvas.width / 2, canvas.height / 2 + 20);
    }
    if (freezeActive && gameState === "running") {
        ctx.fillStyle = "rgba(123,255,159,0.14)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#7bff9f";
        ctx.font = "18px 'Segoe UI'";
        ctx.textAlign = "center";
        ctx.fillText("Time Locked", canvas.width / 2, 40);
    }
}
function gameLoop(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const delta = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;
    if (gameState === "running") {
        updateEffects(performance.now());
        player.update(delta);
        if (inputState.shoot) player.tryShoot();
        updateBullets(delta);
        handleBulletHits();
        updatePowerUps(delta);
        updateCentipedes(delta);
        checkCentipedeCollisions();
        if (centipedes.length === 0 && gameState === "running") nextLevel();
    }
    render(delta);
    requestAnimationFrame(gameLoop);
}
function beginGame() {
    score = 0;
    level = 1;
    lives = 3;
    player.reset();
    clearEffects();
    resetLevel(true, false);
    updateLabels();
    setStatus("Level 1");
    gameState = "running";
}
function restartGame() {
    beginGame();
}
function handleKeyDown(event) {
    const key = event.key.toLowerCase();
    if (event.key === " " || key === "arrowleft" || key === "arrowright" || key === "arrowup" || key === "arrowdown") event.preventDefault();
    if (key === "arrowleft" || key === "a") inputState.left = true;
    if (key === "arrowright" || key === "d") inputState.right = true;
    if (key === "arrowup" || key === "w") inputState.up = true;
    if (key === "arrowdown" || key === "s") inputState.down = true;
    if (event.key === " ") inputState.shoot = true;
    if (key === "enter") {
        if (gameState === "ready") beginGame();
        else if (gameState === "gameover") restartGame();
    }
}
function handleKeyUp(event) {
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") inputState.left = false;
    if (key === "arrowright" || key === "d") inputState.right = false;
    if (key === "arrowup" || key === "w") inputState.up = false;
    if (key === "arrowdown" || key === "s") inputState.down = false;
    if (event.key === " ") inputState.shoot = false;
}
window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);
setStatus("Press Enter to start.");
updateLabels();
requestAnimationFrame(gameLoop);