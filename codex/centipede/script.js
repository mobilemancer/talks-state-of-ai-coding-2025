const canvas = document.getElementById('game')
const ctx = canvas.getContext('2d')
const scoreEl = document.getElementById('score')
const livesEl = document.getElementById('lives')
const levelEl = document.getElementById('level')
const controlsOverlay = document.querySelector('.controls-overlay')
const modal = document.getElementById('powerup-modal')
const modalTitle = document.getElementById('modal-title')
const modalDescription = document.getElementById('modal-description')
const gridSize = 20
const rows = canvas.height / gridSize
const cols = canvas.width / gridSize
const basePlayerSpeed = 220
const baseFireCooldown = 260
const bulletSpeed = 520
const dropChance = 0.32
let lastTime = 0
let accumulator = 0
let score = 0
let lives = 3
let level = 1
let running = false
let started = false
let gameOver = false
let spawnTimer = 0
let powerupMessageTimer = 0
const input = { left: false, right: false, up: false, down: false, fire: false }
const bullets = []
const mushrooms = []
const centipedes = []
const powerups = []
const particles = []
const activePowerups = {
rapidFire: [],
shield: [],
slowdown: [],
spread: [],
mega: [],
doublePoints: [],
speed: [],
freeze: [],
auto: []
}
let turretTimer = 0
const player = {
x: canvas.width / 2,
y: canvas.height - gridSize * 1.5,
width: gridSize,
height: gridSize,
speed: basePlayerSpeed,
fireCooldown: 0,
shield: 0
}
const powerupTypes = {
rapidFire: { name: 'Rapid Fire', color: '#00ffea', duration: 12000, description: 'Blazing shots reduce cooldown.' },
shield: { name: 'Quantum Shield', color: '#9b5cff', duration: 15000, description: 'Absorbs one hit per stack.' },
extraLife: { name: 'Extra Life', color: '#fffb00', duration: 0, description: 'Bonus life awarded instantly.' },
slowdown: { name: 'Temporal Drag', color: '#ff2e74', duration: 8000, description: 'Centipedes crawl slower.' },
spread: { name: 'Neon Spread', color: '#00ff6f', duration: 10000, description: 'Fires triple shot per stack.' },
mega: { name: 'Ion Pierce', color: '#ff7b00', duration: 10000, description: 'Shots pierce through foes.' },
doublePoints: { name: 'Score Surge', color: '#00b8ff', duration: 12000, description: 'Score multiplier boosts rewards.' },
speed: { name: 'Thruster Boost', color: '#ff00f5', duration: 12000, description: 'Player speed intensifies.' },
mushroomBomb: { name: 'Pulse Bomb', color: '#f5f5f5', duration: 0, description: 'Nearby mushrooms vaporize.' },
freeze: { name: 'Stasis Field', color: '#a0ff00', duration: 5000, description: 'Centipedes freeze in place.' },
auto: { name: 'Auto Turret', color: '#6bffeb', duration: 10000, description: 'Automatic precision firing.' }
}
function resetGameState() {
score = 0
lives = 3
level = 1
started = true
running = true
gameOver = false
spawnTimer = 0
bullets.length = 0
mushrooms.length = 0
centipedes.length = 0
powerups.length = 0
particles.length = 0
player.x = canvas.width / 2
player.y = canvas.height - gridSize * 1.5
player.fireCooldown = 0
player.shield = 0
Object.keys(activePowerups).forEach(k => activePowerups[k].length = 0)
controlsOverlay.classList.add('hidden')
updateHud()
spawnMushroomField()
spawnCentipede()
}
function spawnMushroomField() {
const mushroomCount = 35 + level * 3
for (let i = 0; i < mushroomCount; i++) {
const gx = Math.floor(Math.random() * cols)
const gy = Math.floor(Math.random() * (rows - 6)) + 2
if (!getMushroomAt(gx, gy)) {
mushrooms.push({ x: gx, y: gy, health: 4 })
}
}
}
function spawnCentipede() {
const length = Math.min(12 + level * 2, 30)
const segments = []
for (let i = 0; i < length; i++) {
segments.push({ x: cols - 1 - i, y: 0 })
}
centipedes.push({ segments, dir: 1, pendingDrop: false, moveTimer: 0, moveDelay: Math.max(180 - level * 10, 60) })
}
function getMushroomAt(x, y) {
return mushrooms.find(m => m.x === x && m.y === y)
}
function update(time) {
if (!running) {
lastTime = time
requestAnimationFrame(update)
return
}
const delta = (time - lastTime) / 1000
lastTime = time
accumulator += delta
while (accumulator > 0.016) {
step(0.016)
accumulator -= 0.016
}
draw()
requestAnimationFrame(update)
}
function step(dt) {
if (gameOver) return
updatePowerupTimers(dt)
handleInput(dt)
updateBullets(dt)
updateCentipedes(dt)
updatePowerups(dt)
updateParticles(dt)
checkCollisions()
spawnTimer += dt
if (centipedes.length === 0) {
level++
levelEl.textContent = level
spawnMushroomField()
spawnCentipede()
}
powerupMessageTimer -= dt
if (powerupMessageTimer <= 0) {
modal.classList.add('hidden')
}
}
function updatePowerupTimers(dt) {
Object.entries(activePowerups).forEach(([key, list]) => {
for (let i = list.length - 1; i >= 0; i--) {
list[i] -= dt * 1000
if (list[i] <= 0) list.splice(i, 1)
}
})
player.shield = activePowerups.shield.length
player.speed = basePlayerSpeed * (1 + activePowerups.speed.length * 0.35)
const rapidStacks = activePowerups.rapidFire.length
player.fireRate = baseFireCooldown / (1 + rapidStacks * 0.65)
const slowStacks = activePowerups.slowdown.length
centipedes.forEach(c => c.moveDelay = Math.max(Math.max(180 - level * 10, 60) * (1 + slowStacks * 0.45), 50))
const freezeStacks = activePowerups.freeze.length
centipedes.forEach(c => c.frozen = freezeStacks > 0)
turretTimer -= dt
if (turretTimer < 0) turretTimer = 0
if (activePowerups.auto.length > 0) {
if (turretTimer === 0) {
fireBullet()
turretTimer = 0.22 / (1 + activePowerups.auto.length * 0.5)
}
}
}
function handleInput(dt) {
const horizontal = (input.left ? -1 : 0) + (input.right ? 1 : 0)
const vertical = (input.up ? -1 : 0) + (input.down ? 1 : 0)
player.x += horizontal * player.speed * dt
player.y += vertical * player.speed * dt
const minY = canvas.height - gridSize * 4
if (player.y < minY) player.y = minY
if (player.y > canvas.height - gridSize * 1.5) player.y = canvas.height - gridSize * 1.5
if (player.x < gridSize / 2) player.x = gridSize / 2
if (player.x > canvas.width - gridSize / 2) player.x = canvas.width - gridSize / 2
resolvePlayerCollisions()
if (player.fireCooldown > 0) player.fireCooldown -= dt * 1000
if ((input.fire || activePowerups.auto.length > 0) && player.fireCooldown <= 0) {
fireBullet()
player.fireCooldown = player.fireRate || baseFireCooldown
}
}
function resolvePlayerCollisions() {
const playerBox = { x: player.x - player.width / 2, y: player.y - player.height / 2, w: player.width, h: player.height }
mushrooms.forEach(m => {
const mx = m.x * gridSize
const my = m.y * gridSize
if (playerBox.x < mx + gridSize && playerBox.x + playerBox.w > mx && playerBox.y < my + gridSize && playerBox.y + playerBox.h > my) {
if (player.x > mx + gridSize / 2) player.x = mx + gridSize + player.width / 2
else if (player.x < mx + gridSize / 2) player.x = mx - player.width / 2
if (player.y > my + gridSize / 2) player.y = my + gridSize + player.height / 2
else if (player.y < my + gridSize / 2) player.y = my - player.height / 2
}
})
}
function fireBullet() {
const spreadStacks = activePowerups.spread.length
const totalShots = spreadStacks > 0 ? 1 + spreadStacks * 2 : 1
const megaStacks = activePowerups.mega.length
const pierce = megaStacks > 0 ? 1 + megaStacks : 0
const angles = []
if (totalShots === 1) angles.push(0)
else {
const angleStep = 0.15
const offset = (totalShots - 1) * angleStep / 2
for (let i = 0; i < totalShots; i++) angles.push(-offset + i * angleStep)
}
angles.forEach(a => {
bullets.push({ x: player.x, y: player.y - player.height / 2, vx: Math.sin(a) * bulletSpeed, vy: -Math.cos(a) * bulletSpeed, pierce })
})
}
function updateBullets(dt) {
for (let i = bullets.length - 1; i >= 0; i--) {
const b = bullets[i]
b.x += b.vx * dt
b.y += b.vy * dt
if (b.x < -20 || b.x > canvas.width + 20 || b.y < -40) {
bullets.splice(i, 1)
continue
}
for (let j = mushrooms.length - 1; j >= 0; j--) {
const m = mushrooms[j]
const mx = m.x * gridSize
const my = m.y * gridSize
if (b.x > mx && b.x < mx + gridSize && b.y > my && b.y < my + gridSize) {
m.health--
spawnParticles(mx + gridSize / 2, my + gridSize / 2, powerupTypes.mushroomBomb.color)
if (m.health <= 0) {
maybeDropPowerup(mx + gridSize / 2, my + gridSize / 2)
mushrooms.splice(j, 1)
score += 5 * scoreMultiplier()
updateHud()
}
if (b.pierce > 0) b.pierce--
else {
bullets.splice(i, 1)
}
break
}
}
}
}
function updateCentipedes(dt) {
centipedes.forEach((centipede, index) => {
if (centipede.frozen) return
centipede.moveTimer += dt * 1000
if (centipede.moveTimer < centipede.moveDelay) return
centipede.moveTimer = 0
const segments = centipede.segments
if (segments.length === 0) return
const head = segments[0]
let nextX = head.x + centipede.dir
let nextY = head.y
if (centipede.pendingDrop) {
nextY = head.y + 1
nextX = head.x
centipede.pendingDrop = false
} else {
if (nextX < 0 || nextX >= cols || getMushroomAt(nextX, nextY)) {
centipede.pendingDrop = true
centipede.dir *= -1
nextX = head.x
nextY = head.y + 1
}
}
for (let i = segments.length - 1; i > 0; i--) {
segments[i].x = segments[i - 1].x
segments[i].y = segments[i - 1].y
}
segments[0].x = nextX
segments[0].y = nextY
if (segments[0].y >= rows - 1) {
loseLife()
}
})
for (let i = centipedes.length - 1; i >= 0; i--) {
if (centipedes[i].segments.length === 0) centipedes.splice(i, 1)
}
}
function updatePowerups(dt) {
for (let i = powerups.length - 1; i >= 0; i--) {
const p = powerups[i]
p.phase += dt * 5
p.float += dt * 20
p.y += Math.sin(p.phase) * 0.6
if (p.y > canvas.height - gridSize) p.y = canvas.height - gridSize
}
}
function updateParticles(dt) {
for (let i = particles.length - 1; i >= 0; i--) {
const part = particles[i]
part.life -= dt
if (part.life <= 0) {
particles.splice(i, 1)
continue
}
part.x += part.vx * dt
part.y += part.vy * dt
}
}
function checkCollisions() {
for (let i = bullets.length - 1; i >= 0; i--) {
const b = bullets[i]
let hit = false
for (let c = centipedes.length - 1; c >= 0; c--) {
const centipede = centipedes[c]
for (let s = 0; s < centipede.segments.length; s++) {
const seg = centipede.segments[s]
const sx = seg.x * gridSize
const sy = seg.y * gridSize
if (b.x > sx && b.x < sx + gridSize && b.y > sy && b.y < sy + gridSize) {
handleSegmentHit(c, s, sx + gridSize / 2, sy + gridSize / 2)
if (b.pierce > 0) b.pierce--
else bullets.splice(i, 1)
spawnParticles(sx + gridSize / 2, sy + gridSize / 2, powerupTypes.rapidFire.color)
hit = true
break
}
}
if (hit) break
}
}
const playerBox = { x: player.x - player.width / 2, y: player.y - player.height / 2, w: player.width, h: player.height }
centipedes.forEach(c => {
c.segments.forEach(seg => {
const sx = seg.x * gridSize
const sy = seg.y * gridSize
if (playerBox.x < sx + gridSize && playerBox.x + playerBox.w > sx && playerBox.y < sy + gridSize && playerBox.y + playerBox.h > sy) {
if (player.shield > 0) {
activePowerups.shield.pop()
player.shield = activePowerups.shield.length
spawnParticles(player.x, player.y, powerupTypes.shield.color)
} else loseLife()
}
})
})
for (let i = powerups.length - 1; i >= 0; i--) {
const p = powerups[i]
const dx = p.x - player.x
const dy = p.y - player.y
const dist = Math.hypot(dx, dy)
if (dist < gridSize) {
collectPowerup(p)
powerups.splice(i, 1)
continue
}
for (let j = bullets.length - 1; j >= 0; j--) {
const b = bullets[j]
if (Math.hypot(p.x - b.x, p.y - b.y) < gridSize / 2) {
collectPowerup(p)
powerups.splice(i, 1)
bullets.splice(j, 1)
break
}
}
}
}
function handleSegmentHit(ci, si, x, y) {
const centipede = centipedes[ci]
const tail = centipede.segments.splice(si)
tail.shift()
if (tail.length > 0) centipedes.push({ segments: tail, dir: -centipede.dir, pendingDrop: true, moveTimer: 0, moveDelay: centipede.moveDelay })
score += 10 * scoreMultiplier()
updateHud()
maybeDropPowerup(x, y)
if (!getMushroomAt(Math.floor(x / gridSize), Math.floor(y / gridSize))) mushrooms.push({ x: Math.floor(x / gridSize), y: Math.floor(y / gridSize), health: 4 })
}
function loseLife() {
if (!running || gameOver) return
if (player.shield > 0) {
activePowerups.shield.pop()
player.shield = activePowerups.shield.length
spawnParticles(player.x, player.y, powerupTypes.shield.color)
return
}
lives--
updateHud()
if (lives <= 0) {
gameOver = true
running = false
controlsOverlay.classList.remove('hidden')
controlsOverlay.querySelector('p').textContent = 'Game Over — Press Enter to Restart'
} else {
player.x = canvas.width / 2
player.y = canvas.height - gridSize * 1.5
bullets.length = 0
}
}
function maybeDropPowerup(x, y) {
if (Math.random() < dropChance) {
const keys = Object.keys(powerupTypes)
const type = keys[Math.floor(Math.random() * keys.length)]
powerups.push({ x, y, type, phase: Math.random() * Math.PI * 2, float: 0 })
}
}
function collectPowerup(powerup) {
const data = powerupTypes[powerup.type]
showPowerupModal(data.name, data.description)
if (powerup.type === 'extraLife') {
lives++
updateHud()
spawnParticles(player.x, player.y, data.color)
return
}
if (powerup.type === 'mushroomBomb') {
for (let i = mushrooms.length - 1; i >= 0; i--) {
const m = mushrooms[i]
const mx = m.x * gridSize
const my = m.y * gridSize
if (Math.hypot(mx + gridSize / 2 - player.x, my + gridSize / 2 - player.y) < gridSize * 6) {
maybeDropPowerup(mx + gridSize / 2, my + gridSize / 2)
mushrooms.splice(i, 1)
score += 5 * scoreMultiplier()
}
}
updateHud()
spawnParticles(player.x, player.y, data.color)
return
}
if (powerup.type === 'doublePoints') activePowerups.doublePoints.push(powerupTypes.doublePoints.duration)
else if (powerup.type === 'rapidFire') activePowerups.rapidFire.push(powerupTypes.rapidFire.duration)
else if (powerup.type === 'shield') activePowerups.shield.push(powerupTypes.shield.duration)
else if (powerup.type === 'slowdown') activePowerups.slowdown.push(powerupTypes.slowdown.duration)
else if (powerup.type === 'spread') activePowerups.spread.push(powerupTypes.spread.duration)
else if (powerup.type === 'mega') activePowerups.mega.push(powerupTypes.mega.duration)
else if (powerup.type === 'speed') activePowerups.speed.push(powerupTypes.speed.duration)
else if (powerup.type === 'freeze') activePowerups.freeze.push(powerupTypes.freeze.duration)
else if (powerup.type === 'auto') activePowerups.auto.push(powerupTypes.auto.duration)
spawnParticles(player.x, player.y, data.color)
}
function scoreMultiplier() {
const stacks = activePowerups.doublePoints.length
return Math.max(1, stacks + 1)
}
function showPowerupModal(title, description) {
modalTitle.textContent = title
modalDescription.textContent = description
modal.classList.remove('hidden')
powerupMessageTimer = 1.8
}
function spawnParticles(x, y, color) {
for (let i = 0; i < 12; i++) {
const angle = Math.random() * Math.PI * 2
particles.push({ x, y, vx: Math.cos(angle) * 90, vy: Math.sin(angle) * 90, life: 0.4 + Math.random() * 0.4, color })
}
}
function draw() {
ctx.clearRect(0, 0, canvas.width, canvas.height)
drawBackground()
drawMushrooms()
drawPowerups()
drawCentipedes()
drawBullets()
drawPlayer()
drawParticles()
}
function drawBackground() {
const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
gradient.addColorStop(0, '#120035')
gradient.addColorStop(1, '#040010')
ctx.fillStyle = gradient
ctx.fillRect(0, 0, canvas.width, canvas.height)
ctx.save()
ctx.strokeStyle = 'rgba(0,255,204,0.12)'
ctx.lineWidth = 1
for (let x = 0; x <= canvas.width; x += gridSize) {
ctx.beginPath()
ctx.moveTo(x, 0)
ctx.lineTo(x, canvas.height)
ctx.stroke()
}
for (let y = 0; y <= canvas.height; y += gridSize) {
ctx.beginPath()
ctx.moveTo(0, y)
ctx.lineTo(canvas.width, y)
ctx.stroke()
}
ctx.restore()
}
function drawPlayer() {
ctx.save()
ctx.translate(player.x, player.y)
ctx.fillStyle = '#00ffea'
ctx.beginPath()
ctx.moveTo(0, -player.height / 2)
ctx.lineTo(player.width / 2, player.height / 2)
ctx.lineTo(-player.width / 2, player.height / 2)
ctx.closePath()
ctx.fill()
if (player.shield > 0) {
ctx.strokeStyle = 'rgba(155,92,255,0.7)'
ctx.lineWidth = 3
ctx.beginPath()
ctx.arc(0, 0, player.width, 0, Math.PI * 2)
ctx.stroke()
}
ctx.restore()
}
function drawBullets() {
ctx.fillStyle = '#f8f8f8'
bullets.forEach(b => {
ctx.save()
ctx.translate(b.x, b.y)
ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2)
ctx.fillRect(-2, -8, 4, 12)
ctx.restore()
})
}
function drawMushrooms() {
mushrooms.forEach(m => {
const x = m.x * gridSize
const y = m.y * gridSize
const gradient = ctx.createRadialGradient(x + gridSize / 2, y + gridSize / 2, 4, x + gridSize / 2, y + gridSize / 2, 14)
gradient.addColorStop(0, '#ff00f5')
gradient.addColorStop(1, '#500069')
ctx.fillStyle = gradient
ctx.beginPath()
ctx.roundRect(x + 3, y + 3, gridSize - 6, gridSize - 6, 6)
ctx.fill()
})
}
function drawCentipedes() {
centipedes.forEach(centipede => {
centipede.segments.forEach((seg, index) => {
const x = seg.x * gridSize
const y = seg.y * gridSize
ctx.fillStyle = index === 0 ? '#00ff6f' : '#ff2e74'
ctx.beginPath()
ctx.roundRect(x + 2, y + 2, gridSize - 4, gridSize - 4, 10)
ctx.fill()
ctx.strokeStyle = 'rgba(0,255,204,0.6)'
ctx.strokeRect(x + 4, y + 4, gridSize - 8, gridSize - 8)
})
})
}
function drawPowerups() {
powerups.forEach(p => {
const data = powerupTypes[p.type]
const radius = 8 + Math.sin(p.phase * 3) * 3
ctx.beginPath()
ctx.arc(p.x, p.y + Math.sin(p.phase) * 4, radius, 0, Math.PI * 2)
ctx.fillStyle = data.color
ctx.fill()
ctx.strokeStyle = 'rgba(255,255,255,0.6)'
ctx.lineWidth = 2
ctx.stroke()
})
}
function drawParticles() {
particles.forEach(part => {
ctx.globalAlpha = Math.max(part.life, 0)
ctx.fillStyle = part.color
ctx.fillRect(part.x, part.y, 3, 3)
ctx.globalAlpha = 1
})
}
function updateHud() {
scoreEl.textContent = Math.floor(score)
livesEl.textContent = lives
levelEl.textContent = level
}
document.addEventListener('keydown', e => {
if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = true
if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = true
if (e.code === 'ArrowUp' || e.code === 'KeyW') input.up = true
if (e.code === 'ArrowDown' || e.code === 'KeyS') input.down = true
if (e.code === 'Space') input.fire = true
if (e.code === 'Enter') {
if (!started || gameOver) resetGameState()
else {
running = !running
controlsOverlay.classList.toggle('hidden', running)
if (!running) controlsOverlay.querySelector('p').textContent = 'Paused — Press Enter to Resume'
else controlsOverlay.querySelector('p').textContent = 'Press Enter to Start'
}
}
})
document.addEventListener('keyup', e => {
if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false
if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false
if (e.code === 'ArrowUp' || e.code === 'KeyW') input.up = false
if (e.code === 'ArrowDown' || e.code === 'KeyS') input.down = false
if (e.code === 'Space') input.fire = false
})
requestAnimationFrame(update)
