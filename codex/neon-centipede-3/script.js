const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
const controlOverlay = document.getElementById('controlOverlay');
const overlayTagline = controlOverlay.querySelector('.tagline');
const baseTagline = overlayTagline.textContent;
const scoreValue = document.getElementById('scoreValue');
const livesValue = document.getElementById('livesValue');
const levelValue = document.getElementById('levelValue');
const modal = document.getElementById('powerUpModal');
const modalTitle = document.getElementById('powerUpTitle');
const modalDescription = document.getElementById('powerUpDescription');
const cellSize = 20;
const cols = canvas.width / cellSize;
const rows = canvas.height / cellSize;
const mushrooms = [];
const bullets = [];
const powerUps = [];
const centipedes = [];
let gameState = 'idle';
let score = 0;
let level = 1;
let lives = 3;
let lastTime = 0;
let modalTimer = 0;
let centipedeSpeedModifier = 1;
const keys = {};
const playerZoneTop = canvas.height - 200;
const player = {
x: canvas.width / 2 - cellSize / 2,
y: canvas.height - cellSize * 2,
width: cellSize,
height: cellSize,
baseSpeed: 220,
speed: 220,
baseFireCooldown: 0.45,
fireCooldown: 0.45,
fireTimer: 0,
baseBulletSize: 6,
bulletSize: 6,
baseBulletSpeed: -600,
bulletSpeed: -600,
spread: 0,
piercing: false,
scoreMultiplier: 1,
mega: 0,
shields: 0
};
const activePowerUps = {};
const POWER_UP_LIBRARY = {
rapidFire: {
name: 'Rapid Fire Matrix',
description: 'Fire rate accelerated by neon overdrive.',
duration: 12
},
shield: {
name: 'Quantum Shield',
description: 'Absorbs the next centipede impact.',
duration: 0
},
extraLife: {
name: 'Synth Life',
description: 'Extra life pulsing through your circuits.',
duration: 0
},
slowMotion: {
name: 'Glitch Field',
description: 'Centipedes crawl through temporal syrup.',
duration: 8
},
spreadShot: {
name: 'Tri-Beam Array',
description: 'Bolts split into a triad of plasma.',
duration: 10
},
piercing: {
name: 'Phase Bolts',
description: 'Shots pass through segmented armor.',
duration: 12
},
scoreBoost: {
name: 'Holo Multiplier',
description: 'Score output amplified.',
duration: 14
},
speedBoost: {
name: 'Hover Surge',
description: 'Slide faster along the synth floor.',
duration: 10
},
megaBolt: {
name: 'Nova Cores',
description: 'Bolts expand with explosive force.',
duration: 10
},
timeWarp: {
name: 'Time Fracture',
description: 'Momentarily halt their swarm.',
duration: 5
}
};
function resetPlayerStats() {
player.speed = player.baseSpeed;
player.fireCooldown = player.baseFireCooldown;
player.bulletSize = player.baseBulletSize;
player.bulletSpeed = player.baseBulletSpeed;
player.spread = 0;
player.piercing = false;
player.scoreMultiplier = 1;
player.mega = 0;
centipedeSpeedModifier = 1;
}
function recalcPowerUps() {
resetPlayerStats();
Object.keys(activePowerUps).forEach(type => {
const data = activePowerUps[type];
const stacks = data.stacks;
if (type === 'rapidFire') {
player.fireCooldown = player.baseFireCooldown * Math.pow(0.75, stacks);
}
if (type === 'slowMotion') {
centipedeSpeedModifier = Math.max(0.35, Math.pow(0.78, stacks));
}
if (type === 'spreadShot') {
player.spread = Math.min(4, stacks);
}
if (type === 'piercing') {
player.piercing = true;
}
if (type === 'scoreBoost') {
player.scoreMultiplier = 1 + stacks;
}
if (type === 'speedBoost') {
player.speed = player.baseSpeed * (1 + stacks * 0.35);
}
if (type === 'megaBolt') {
player.mega = stacks;
player.bulletSize = player.baseBulletSize + stacks * 3;
}
});
}
function applyPowerUp(type) {
const info = POWER_UP_LIBRARY[type];
if (!info) return;
if (type === 'extraLife') {
lives += 1;
updateHud();
showModal(info.name, info.description);
return;
}
if (type === 'shield') {
player.shields += 1;
showModal(info.name, info.description);
return;
}
if (!activePowerUps[type]) {
activePowerUps[type] = { stacks: 0, remaining: 0 };
}
activePowerUps[type].stacks += 1;
if (info.duration > 0) {
activePowerUps[type].remaining += info.duration;
}
showModal(info.name, info.description);
recalcPowerUps();
}
function updatePowerUps(dt) {
Object.keys(activePowerUps).forEach(type => {
const info = POWER_UP_LIBRARY[type];
if (!info || info.duration === 0) return;
activePowerUps[type].remaining -= dt;
if (activePowerUps[type].remaining <= 0) {
delete activePowerUps[type];
}
});
recalcPowerUps();
}
function showModal(title, description) {
modalTitle.textContent = title;
modalDescription.textContent = description;
modal.classList.remove('hidden');
modal.style.opacity = '1';
modalTimer = 2.5;
}
function updateModal(dt) {
if (modalTimer > 0) {
modalTimer -= dt;
if (modalTimer <= 0) {
modal.classList.add('hidden');
}
}
}
function initMushrooms() {
mushrooms.length = 0;
const total = 32 + level * 4;
for (let i = 0; i < total; i++) {
const x = Math.floor(Math.random() * cols);
const y = Math.floor(Math.random() * (rows - 8));
if (y < 2) continue;
if (mushrooms.some(m => m.x === x && m.y === y)) continue;
mushrooms.push({ x, y, health: 4 });
}
}
function spawnCentipede() {
const length = 10 + Math.min(20, level * 2);
const startX = Math.floor(Math.random() * (cols - length));
const segments = [];
for (let i = 0; i < length; i++) {
segments.push({ x: startX + i, y: 0 });
}
centipedes.push({ segments, direction: -1, timer: 0, speed: Math.max(0.08, 0.2 - level * 0.006) });
}
function startGame() {
overlayTagline.textContent = baseTagline;
startButton.textContent = 'Start';
score = 0;
level = 1;
lives = 3;
player.x = canvas.width / 2 - cellSize / 2;
player.y = canvas.height - cellSize * 2;
Object.keys(activePowerUps).forEach(k => delete activePowerUps[k]);
player.shields = 0;
recalcPowerUps();
centipedes.length = 0;
bullets.length = 0;
powerUps.length = 0;
initMushrooms();
spawnCentipede();
updateHud();
controlOverlay.classList.add('hidden');
modal.classList.add('hidden');
modalTimer = 0;
lastTime = performance.now();
gameState = 'running';
requestAnimationFrame(loop);
}
function updateHud() {
scoreValue.textContent = Math.floor(score);
livesValue.textContent = lives;
levelValue.textContent = level;
}
function loop(timestamp) {
if (gameState !== 'running') return;
const dt = Math.min(0.033, (timestamp - lastTime) / 1000);
lastTime = timestamp;
update(dt);
draw();
requestAnimationFrame(loop);
}
function update(dt) {
updateInput(dt);
updateBullets(dt);
updateCentipedes(dt);
updatePowerUps(dt);
updateModal(dt);
checkPowerUpCollection();
if (centipedes.length === 0) {
level += 1;
initMushrooms();
spawnCentipede();
updateHud();
}
}
function updateInput(dt) {
let moveX = 0;
let moveY = 0;
if (keys['ArrowLeft'] || keys['a']) moveX -= 1;
if (keys['ArrowRight'] || keys['d']) moveX += 1;
if (keys['ArrowUp'] || keys['w']) moveY -= 1;
if (keys['ArrowDown'] || keys['s']) moveY += 1;
const length = Math.hypot(moveX, moveY);
if (length > 0) {
moveX /= length;
moveY /= length;
}
let newX = player.x + moveX * player.speed * dt;
let newY = player.y + moveY * player.speed * dt;
const leftBound = 0;
const rightBound = canvas.width - player.width;
const topBound = playerZoneTop;
const bottomBound = canvas.height - player.height;
newX = Math.max(leftBound, Math.min(rightBound, newX));
newY = Math.max(topBound, Math.min(bottomBound, newY));
if (!intersectsMushroom(newX, player.y)) {
player.x = newX;
}
if (!intersectsMushroom(player.x, newY)) {
player.y = newY;
}
player.fireTimer -= dt;
if ((keys[' '] || keys['Space']) && player.fireTimer <= 0) {
fire();
}
}
function fire() {
player.fireTimer = player.fireCooldown;
const spread = player.spread;
const boltCount = spread > 0 ? spread + 1 : 1;
const angleStep = spread > 0 ? 0.2 : 0;
const startAngle = -Math.PI / 2 - angleStep * (boltCount - 1) / 2;
for (let i = 0; i < boltCount; i++) {
const angle = startAngle + angleStep * i;
const vx = Math.cos(angle) * Math.abs(player.bulletSpeed);
const vy = Math.sin(angle) * Math.abs(player.bulletSpeed) * -1;
const speedFactor = Math.hypot(vx, vy);
bullets.push({
x: player.x + player.width / 2,
y: player.y,
vx: vx / speedFactor * Math.abs(player.bulletSpeed),
vy: vy / speedFactor * Math.abs(player.bulletSpeed),
size: player.bulletSize,
piercing: player.piercing,
damage: 1 + player.mega
});
}
}
function updateBullets(dt) {
for (let i = bullets.length - 1; i >= 0; i--) {
const b = bullets[i];
b.x += b.vx * dt;
b.y += b.vy * dt;
if (b.y + b.size < 0) {
bullets.splice(i, 1);
continue;
}
let hit = false;
for (let j = mushrooms.length - 1; j >= 0 && !hit; j--) {
const m = mushrooms[j];
const mx = m.x * cellSize;
const my = m.y * cellSize;
if (b.x > mx && b.x < mx + cellSize && b.y > my && b.y < my + cellSize) {
m.health -= b.damage;
hit = true;
if (m.health <= 0) {
maybeSpawnPowerUp(m.x, m.y);
mushrooms.splice(j, 1);
score += 8 * player.scoreMultiplier;
updateHud();
}
}
}
if (hit && !b.piercing) {
bullets.splice(i, 1);
continue;
}
if (b.x < 0 || b.x > canvas.width) {
bullets.splice(i, 1);
}
}
}
function updateCentipedes(dt) {
for (let c = centipedes.length - 1; c >= 0; c--) {
const centipede = centipedes[c];
if (activePowerUps.timeWarp && activePowerUps.timeWarp.remaining > 0) continue;
centipede.timer += dt * centipedeSpeedModifier;
if (centipede.timer < centipede.speed) continue;
centipede.timer = 0;
const original = centipede.segments.map(seg => ({ x: seg.x, y: seg.y }));
const head = centipede.segments[0];
let newX = head.x + centipede.direction;
let newY = head.y;
if (newX < 0 || newX >= cols || hasMushroom(newX, newY)) {
newX = head.x;
newY = head.y + 1;
centipede.direction *= -1;
}
if (newY >= rows) {
handleCentipedeBreach();
centipedes.splice(c, 1);
continue;
}
for (let i = centipede.segments.length - 1; i >= 1; i--) {
centipede.segments[i].x = original[i - 1].x;
centipede.segments[i].y = original[i - 1].y;
}
centipede.segments[0].x = newX;
centipede.segments[0].y = newY;
checkCentipedeCollisions(centipede, c);
}
}
function checkCentipedeCollisions(centipede, index) {
for (let i = 0; i < centipede.segments.length; i++) {
const segment = centipede.segments[i];
const sx = segment.x * cellSize;
const sy = segment.y * cellSize;
if (sx < player.x + player.width && sx + cellSize > player.x && sy < player.y + player.height && sy + cellSize > player.y) {
handlePlayerHit();
}
for (let b = bullets.length - 1; b >= 0; b--) {
const bullet = bullets[b];
if (bullet.x > sx && bullet.x < sx + cellSize && bullet.y > sy && bullet.y < sy + cellSize) {
score += 120 * player.scoreMultiplier;
updateHud();
maybeSpawnPowerUp(segment.x, segment.y);
maybePlantMushroom(segment.x, segment.y);
splitCentipede(index, i);
if (!bullet.piercing) bullets.splice(b, 1);
return;
}
}
}
}
function splitCentipede(centipedeIndex, segmentIndex) {
const centipede = centipedes[centipedeIndex];
const headPart = centipede.segments.slice(0, segmentIndex);
const tailPart = centipede.segments.slice(segmentIndex + 1);
if (headPart.length > 0) {
centipede.segments = headPart;
} else {
centipedes.splice(centipedeIndex, 1);
}
if (tailPart.length > 0) {
const newSegments = tailPart.map(seg => ({ x: seg.x, y: seg.y }));
centipedes.push({ segments: newSegments, direction: centipede.direction, timer: 0, speed: Math.max(0.06, centipede.speed * 0.95) });
}
if (centipedes.length === 0) {
score += 800 * player.scoreMultiplier;
updateHud();
}
}
function maybePlantMushroom(x, y) {
if (Math.random() < 0.6 && !hasMushroom(x, y)) {
mushrooms.push({ x, y, health: 4 });
}
}
function maybeSpawnPowerUp(x, y) {
if (Math.random() < 0.28) {
const types = Object.keys(POWER_UP_LIBRARY);
const type = types[Math.floor(Math.random() * types.length)];
powerUps.push({ x: x * cellSize + cellSize / 2, y: y * cellSize + cellSize / 2, type, pulse: Math.random() * Math.PI * 2 });
}
}
function checkPowerUpCollection() {
for (let i = powerUps.length - 1; i >= 0; i--) {
const p = powerUps[i];
const radius = 10;
if (p.x > player.x && p.x < player.x + player.width && p.y > player.y && p.y < player.y + player.height) {
collectPowerUp(i);
continue;
}
for (let b = bullets.length - 1; b >= 0; b--) {
const bullet = bullets[b];
if (Math.hypot(bullet.x - p.x, bullet.y - p.y) < radius + bullet.size) {
collectPowerUp(i);
if (!bullet.piercing) bullets.splice(b, 1);
break;
}
}
}
}
function collectPowerUp(index) {
const p = powerUps[index];
powerUps.splice(index, 1);
applyPowerUp(p.type);
}
function handleCentipedeBreach() {
if (player.shields > 0) {
player.shields -= 1;
showModal('Shield Expended', 'The quantum barrier absorbed the breach.');
return;
}
lives -= 1;
updateHud();
if (lives <= 0) {
gameOver();
} else {
resetRound();
}
}
function handlePlayerHit() {
if (player.shields > 0) {
player.shields -= 1;
showModal('Shield Expended', 'Impact deflected by your barrier.');
return;
}
lives -= 1;
updateHud();
if (lives <= 0) {
gameOver();
} else {
resetRound();
}
}
function resetRound() {
player.x = canvas.width / 2 - cellSize / 2;
player.y = canvas.height - cellSize * 2;
bullets.length = 0;
centipedes.length = 0;
spawnCentipede();
}
function gameOver() {
controlOverlay.classList.remove('hidden');
overlayTagline.textContent = 'Final Score ' + Math.floor(score);
startButton.textContent = 'Restart';
gameState = 'idle';
}
function hasMushroom(x, y) {
return mushrooms.some(m => m.x === x && m.y === y);
}
function intersectsMushroom(x, y) {
return mushrooms.some(m => {
const mx = m.x * cellSize;
const my = m.y * cellSize;
return x < mx + cellSize && x + player.width > mx && y < my + cellSize && y + player.height > my;
});
}
function drawGrid() {
ctx.fillStyle = 'rgba(0,0,0,0.15)';
for (let x = 0; x <= canvas.width; x += cellSize) {
ctx.fillRect(x, 0, 1, canvas.height);
}
for (let y = 0; y <= canvas.height; y += cellSize) {
ctx.fillRect(0, y, canvas.width, 1);
}
}
function draw() {
ctx.clearRect(0, 0, canvas.width, canvas.height);
const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
gradient.addColorStop(0, '#1c0030');
gradient.addColorStop(1, '#050010');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, canvas.width, canvas.height);
drawGrid();
drawMushrooms();
drawCentipedes();
drawPlayer();
drawBullets();
drawPowerUps();
}
function drawMushrooms() {
mushrooms.forEach(m => {
const x = m.x * cellSize + cellSize / 2;
const y = m.y * cellSize + cellSize / 2;
const hue = 280 + m.health * 20;
const radius = cellSize / 2.6;
const gradient = ctx.createRadialGradient(x, y, radius * 0.3, x, y, radius);
gradient.addColorStop(0, `hsla(${hue}, 90%, 70%, 0.9)`);
gradient.addColorStop(1, `hsla(${hue}, 100%, 45%, 0.6)`);
ctx.fillStyle = gradient;
ctx.beginPath();
ctx.arc(x, y, radius, 0, Math.PI * 2);
ctx.fill();
ctx.strokeStyle = `hsla(${hue}, 100%, 80%, 0.8)`;
ctx.lineWidth = 2;
ctx.stroke();
});
}
function drawCentipedes() {
centipedes.forEach(centipede => {
centipede.segments.forEach((segment, index) => {
const x = segment.x * cellSize + cellSize / 2;
const y = segment.y * cellSize + cellSize / 2;
const hue = 120 + (index * 12) % 120;
const radius = cellSize / 2.1;
const glow = ctx.createRadialGradient(x, y, radius * 0.3, x, y, radius);
glow.addColorStop(0, `hsla(${hue}, 100%, 75%, 0.95)`);
glow.addColorStop(1, `hsla(${hue}, 100%, 45%, 0.7)`);
ctx.fillStyle = glow;
ctx.beginPath();
ctx.arc(x, y, radius, 0, Math.PI * 2);
ctx.fill();
ctx.strokeStyle = 'rgba(0,255,255,0.8)';
ctx.lineWidth = index === 0 ? 3 : 1.5;
ctx.stroke();
});
});
}
function drawPlayer() {
const x = player.x + player.width / 2;
const y = player.y + player.height / 2;
const gradient = ctx.createRadialGradient(x, y, player.width * 0.2, x, y, player.width);
gradient.addColorStop(0, '#fffbdb');
gradient.addColorStop(1, '#ff1dbd');
ctx.fillStyle = gradient;
ctx.beginPath();
ctx.moveTo(player.x, player.y + player.height);
ctx.lineTo(player.x + player.width / 2, player.y);
ctx.lineTo(player.x + player.width, player.y + player.height);
ctx.closePath();
ctx.fill();
if (player.shields > 0) {
ctx.strokeStyle = 'rgba(0,255,255,0.7)';
ctx.lineWidth = 3;
ctx.beginPath();
ctx.arc(x, y, player.width, 0, Math.PI * 2);
ctx.stroke();
}
}
function drawBullets() {
ctx.fillStyle = '#14f1ff';
bullets.forEach(b => {
const gradient = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.size * 1.8);
gradient.addColorStop(0, '#fefefe');
gradient.addColorStop(1, player.mega > 0 ? '#ff4df3' : '#14f1ff');
ctx.fillStyle = gradient;
ctx.beginPath();
ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
ctx.fill();
});
}
function drawPowerUps() {
powerUps.forEach(p => {
p.pulse += 0.06;
const radius = 10 + Math.sin(p.pulse) * 3;
const hueMap = {
rapidFire: 180,
shield: 200,
extraLife: 60,
slowMotion: 260,
spreadShot: 320,
piercing: 0,
scoreBoost: 120,
speedBoost: 30,
megaBolt: 300,
timeWarp: 210
};
const hue = hueMap[p.type] || Math.floor(Math.random() * 360);
const gradient = ctx.createRadialGradient(p.x, p.y, radius * 0.3, p.x, p.y, radius);
gradient.addColorStop(0, `hsla(${hue}, 100%, 80%, 1)`);
gradient.addColorStop(1, `hsla(${hue}, 100%, 45%, 0.8)`);
ctx.fillStyle = gradient;
ctx.beginPath();
ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
ctx.fill();
ctx.strokeStyle = `hsla(${hue}, 100%, 80%, 0.9)`;
ctx.lineWidth = 2;
ctx.stroke();
});
}
startButton.addEventListener('click', startGame);
document.addEventListener('keydown', e => {
if (e.key === 'Enter' && gameState !== 'running') {
startGame();
return;
}
keys[e.key] = true;
if (e.code === 'Space') e.preventDefault();
});
document.addEventListener('keyup', e => {
keys[e.key] = false;
});
updateHud();
