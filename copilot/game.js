class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 800;
        this.canvas.height = 600;
        
        this.gameState = 'start';
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.levelTransition = false;
        this.levelTransitionTime = 0;
        
        this.player = new Player(this.canvas.width / 2, this.canvas.height - 50);
        this.bullets = [];
        this.centipedes = [];
        this.mushrooms = [];
        this.powerups = [];
        this.activePowerups = new Map();
        
        this.keys = {};
        this.lastShot = 0;
        this.shotDelay = 200;
        
        this.powerupTypes = [
            { name: 'Rapid Fire', color: '#ff0000', description: 'Faster shooting!' },
            { name: 'Shield', color: '#0000ff', description: 'Temporary invincibility!' },
            { name: 'Extra Life', color: '#ffff00', description: 'Gain an extra life!' },
            { name: 'Slowdown', color: '#ff00ff', description: 'Enemies move slower!' },
            { name: 'Spread Shot', color: '#00ffff', description: 'Shoot multiple bullets!' },
            { name: 'Big Bullets', color: '#ffa500', description: 'Larger, more powerful shots!' },
            { name: 'Speed Boost', color: '#00ff00', description: 'Move faster!' },
            { name: 'Piercing Shot', color: '#ffffff', description: 'Bullets go through enemies!' },
            { name: 'Score Multiplier', color: '#ff69b4', description: '2x score for 10 seconds!' },
            { name: 'Freeze', color: '#87ceeb', description: 'Freeze all enemies!' },
            { name: 'Mega Shot', color: '#9400d3', description: 'Destroy multiple segments!' },
            { name: 'Auto Fire', color: '#dc143c', description: 'Automatic shooting!' }
        ];
        
        this.initializeLevel();
        this.setupEventListeners();
        this.gameLoop();
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'Enter') {
                if (this.gameState === 'start' || this.gameState === 'gameOver') {
                    this.startGame();
                }
            }
            if (e.code === 'Space') {
                e.preventDefault();
                this.shoot();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }
    
    startGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.levelTransition = false;
        this.levelTransitionTime = 0;
        this.bullets = [];
        this.powerups = [];
        this.activePowerups.clear();
        this.player = new Player(this.canvas.width / 2, this.canvas.height - 50);
        this.initializeLevel();
        document.getElementById('startScreen').classList.add('hidden');
        document.getElementById('gameOverScreen').classList.add('hidden');
    }
    
    initializeLevel() {
        this.mushrooms = [];
        this.centipedes = [];
        
        for (let i = 0; i < 30 + this.level * 5; i++) {
            this.mushrooms.push(new Mushroom(
                Math.random() * (this.canvas.width - 20),
                50 + Math.random() * (this.canvas.height - 150)
            ));
        }
        
        this.centipedes.push(new Centipede(0, 50, 12 + this.level * 2, this.level));
    }
    
    shoot() {
        if (this.gameState !== 'playing') return;
        
        const now = Date.now();
        const delay = this.activePowerups.has('Rapid Fire') ? 50 : 
                     this.activePowerups.has('Auto Fire') ? 100 : this.shotDelay;
        
        if (now - this.lastShot > delay) {
            const spreadShot = this.activePowerups.has('Spread Shot');
            const bigBullets = this.activePowerups.has('Big Bullets');
            const piercing = this.activePowerups.has('Piercing Shot');
            const mega = this.activePowerups.has('Mega Shot');
            
            if (spreadShot) {
                this.bullets.push(new Bullet(this.player.x - 5, this.player.y, -1, bigBullets, piercing, mega));
                this.bullets.push(new Bullet(this.player.x, this.player.y, 0, bigBullets, piercing, mega));
                this.bullets.push(new Bullet(this.player.x + 5, this.player.y, 1, bigBullets, piercing, mega));
            } else {
                this.bullets.push(new Bullet(this.player.x, this.player.y, 0, bigBullets, piercing, mega));
            }
            this.lastShot = now;
        }
    }
    
    update() {
        if (this.gameState !== 'playing') return;
        
        if (this.levelTransition) {
            this.levelTransitionTime += 16; // Assuming 60fps, 16ms per frame
            if (this.levelTransitionTime >= 2000) { // 2 seconds
                this.levelTransition = false;
                this.levelTransitionTime = 0;
                this.initializeLevel();
                document.getElementById('levelUpModal').classList.add('hidden');
            }
            return; // Don't update game during transition
        }
        
        if (this.activePowerups.has('Auto Fire')) {
            this.shoot();
        }
        
        this.player.update(this.keys, this.activePowerups.has('Speed Boost'));
        
        this.bullets.forEach(bullet => bullet.update());
        this.bullets = this.bullets.filter(bullet => bullet.y > 0);
        
        const slowdown = this.activePowerups.has('Slowdown');
        const freeze = this.activePowerups.has('Freeze');
        
        this.centipedes.forEach(centipede => {
            if (!freeze) centipede.update(this.mushrooms, slowdown);
        });
        
        this.powerups.forEach(powerup => powerup.update());
        this.powerups = this.powerups.filter(powerup => powerup.active);
        
        this.checkCollisions();
        this.updatePowerups();
        
        if (this.centipedes.length === 0 && !this.levelTransition) {
            this.level++;
            this.levelTransition = true;
            this.levelTransitionTime = 0;
            this.showLevelUp();
        }
        
        if (this.lives <= 0) {
            this.gameOver();
        }
    }
    
    checkCollisions() {
        this.bullets.forEach((bullet, bulletIndex) => {
            this.mushrooms.forEach((mushroom, mushroomIndex) => {
                if (bullet.collidesWith(mushroom)) {
                    mushroom.hit();
                    if (!bullet.piercing) {
                        this.bullets.splice(bulletIndex, 1);
                    }
                    if (mushroom.health <= 0) {
                        this.mushrooms.splice(mushroomIndex, 1);
                        this.score += 1;
                        if (Math.random() < 0.3) {
                            this.spawnPowerup(mushroom.x, mushroom.y);
                        }
                    }
                }
            });
            
            this.centipedes.forEach((centipede, centipedeIndex) => {
                centipede.segments.forEach((segment, segmentIndex) => {
                    if (bullet.collidesWith(segment)) {
                        if (!bullet.piercing) {
                            this.bullets.splice(bulletIndex, 1);
                        }
                        
                        const segmentsToRemove = bullet.mega ? 3 : 1;
                        
                        for (let i = 0; i < segmentsToRemove && segmentIndex < centipede.segments.length; i++) {
                            centipede.segments.splice(segmentIndex, 1);
                            this.score += 10;
                            
                            if (Math.random() < 0.4) {
                                this.spawnPowerup(segment.x, segment.y);
                            }
                        }
                        
                        if (centipede.segments.length === 0) {
                            this.centipedes.splice(centipedeIndex, 1);
                        } else if (segmentIndex < centipede.segments.length) {
                            const newCentipede = new Centipede(
                                centipede.segments[segmentIndex].x,
                                centipede.segments[segmentIndex].y,
                                centipede.segments.length - segmentIndex,
                                this.level
                            );
                            centipede.segments = centipede.segments.slice(0, segmentIndex);
                            this.centipedes.push(newCentipede);
                        }
                    }
                });
            });
        });
        
        this.powerups.forEach((powerup, powerupIndex) => {
            if (powerup.collidesWith(this.player)) {
                this.collectPowerup(powerup);
                this.powerups.splice(powerupIndex, 1);
            }
        });
        
        this.bullets.forEach((bullet, bulletIndex) => {
            this.powerups.forEach((powerup, powerupIndex) => {
                if (bullet.collidesWith(powerup)) {
                    this.collectPowerup(powerup);
                    this.powerups.splice(powerupIndex, 1);
                    if (!bullet.piercing) {
                        this.bullets.splice(bulletIndex, 1);
                    }
                }
            });
        });
        
        if (!this.activePowerups.has('Shield')) {
            this.centipedes.forEach(centipede => {
                centipede.segments.forEach(segment => {
                    if (segment.collidesWith(this.player)) {
                        this.lives--;
                        this.player.x = this.canvas.width / 2;
                        this.player.y = this.canvas.height - 50;
                    }
                    
                    if (segment.y >= this.canvas.height - 60) {
                        this.lives--;
                        this.player.x = this.canvas.width / 2;
                        this.player.y = this.canvas.height - 50;
                    }
                });
            });
        }
    }
    
    spawnPowerup(x, y) {
        const type = this.powerupTypes[Math.floor(Math.random() * this.powerupTypes.length)];
        this.powerups.push(new Powerup(x, y, type));
    }
    
    collectPowerup(powerup) {
        const multiplier = this.activePowerups.has('Score Multiplier') ? 2 : 1;
        this.score += 50 * multiplier;
        
        if (powerup.type.name === 'Extra Life') {
            this.lives++;
        } else {
            this.activePowerups.set(powerup.type.name, Date.now() + 10000);
        }
        
        this.showPowerupModal(powerup.type);
    }
    
    showLevelUp() {
        document.getElementById('levelUpTitle').textContent = `LEVEL ${this.level}`;
        document.getElementById('levelUpModal').classList.remove('hidden');
    }
    
    showPowerupModal(type) {
        document.getElementById('powerupTitle').textContent = type.name;
        document.getElementById('powerupDescription').textContent = type.description;
        document.getElementById('powerupModal').classList.remove('hidden');
        
        setTimeout(() => {
            document.getElementById('powerupModal').classList.add('hidden');
        }, 2000);
    }
    
    updatePowerups() {
        const now = Date.now();
        for (const [name, expiry] of this.activePowerups) {
            if (now > expiry) {
                this.activePowerups.delete(name);
            }
        }
    }
    
    gameOver() {
        this.gameState = 'gameOver';
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOverScreen').classList.remove('hidden');
    }
    
    render() {
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.gameState === 'playing') {
            this.player.render(this.ctx, this.activePowerups.has('Shield'));
            this.bullets.forEach(bullet => bullet.render(this.ctx));
            this.mushrooms.forEach(mushroom => mushroom.render(this.ctx));
            this.centipedes.forEach(centipede => centipede.render(this.ctx));
            this.powerups.forEach(powerup => powerup.render(this.ctx));
        }
        
        document.getElementById('scoreValue').textContent = this.score;
        document.getElementById('livesValue').textContent = this.lives;
        document.getElementById('levelValue').textContent = this.level;
    }
    
    gameLoop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
}

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 20;
        this.speed = 4;
    }
    
    update(keys, speedBoost) {
        const speed = speedBoost ? this.speed * 1.5 : this.speed;
        
        if (keys['ArrowLeft'] && this.x > 0) {
            this.x -= speed;
        }
        if (keys['ArrowRight'] && this.x < 800 - this.width) {
            this.x += speed;
        }
        if (keys['ArrowUp'] && this.y > 400) {
            this.y -= speed;
        }
        if (keys['ArrowDown'] && this.y < 600 - this.height) {
            this.y += speed;
        }
    }
    
    render(ctx, shielded) {
        if (shielded) {
            ctx.shadowColor = '#0000ff';
            ctx.shadowBlur = 20;
        }
        
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        ctx.shadowBlur = 0;
    }
    
    collidesWith(other) {
        return this.x < other.x + other.width &&
               this.x + this.width > other.x &&
               this.y < other.y + other.height &&
               this.y + this.height > other.y;
    }
}

class Bullet {
    constructor(x, y, angle = 0, big = false, piercing = false, mega = false) {
        this.x = x;
        this.y = y;
        this.width = big ? 8 : 4;
        this.height = big ? 12 : 8;
        this.speed = 8;
        this.angle = angle;
        this.piercing = piercing;
        this.mega = mega;
        this.big = big;
    }
    
    update() {
        this.y -= this.speed;
        this.x += this.angle * 2;
    }
    
    render(ctx) {
        if (this.piercing) {
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 10;
        } else if (this.mega) {
            ctx.shadowColor = '#9400d3';
            ctx.shadowBlur = 15;
        } else if (this.big) {
            ctx.shadowColor = '#ffa500';
            ctx.shadowBlur = 8;
        }
        
        ctx.fillStyle = this.piercing ? '#ffffff' : this.mega ? '#9400d3' : this.big ? '#ffa500' : '#ffff00';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        ctx.shadowBlur = 0;
    }
    
    collidesWith(other) {
        return this.x < other.x + other.width &&
               this.x + this.width > other.x &&
               this.y < other.y + other.height &&
               this.y + this.height > other.y;
    }
}

class Mushroom {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 20;
        this.health = 4;
        this.maxHealth = 4;
    }
    
    hit() {
        this.health--;
    }
    
    render(ctx) {
        const healthRatio = this.health / this.maxHealth;
        ctx.fillStyle = `rgb(${255 - healthRatio * 255}, ${healthRatio * 255}, 0)`;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
    
    collidesWith(other) {
        return this.x < other.x + other.width &&
               this.x + this.width > other.x &&
               this.y < other.y + other.height &&
               this.y + this.height > other.y;
    }
}

class Centipede {
    constructor(x, y, length, level) {
        this.segments = [];
        this.direction = 1;
        this.speed = 1 + level * 0.2;
        this.dropDistance = 20;
        
        for (let i = 0; i < length; i++) {
            this.segments.push(new CentipedeSegment(x - i * 15, y));
        }
    }
    
    update(mushrooms, slowdown) {
        const speed = slowdown ? this.speed * 0.5 : this.speed;
        
        for (let i = 0; i < this.segments.length; i++) {
            const segment = this.segments[i];
            
            if (i === 0) {
                segment.x += this.direction * speed;
                
                if (segment.x <= 0 || segment.x >= 780) {
                    this.direction *= -1;
                    this.segments.forEach(s => s.y += this.dropDistance);
                }
                
                for (const mushroom of mushrooms) {
                    if (segment.collidesWith(mushroom)) {
                        this.direction *= -1;
                        this.segments.forEach(s => s.y += this.dropDistance);
                        break;
                    }
                }
            } else {
                const prevSegment = this.segments[i - 1];
                const dx = prevSegment.x - segment.x;
                const dy = prevSegment.y - segment.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 15) {
                    segment.x += (dx / distance) * speed;
                    segment.y += (dy / distance) * speed;
                }
            }
        }
    }
    
    render(ctx) {
        this.segments.forEach((segment, index) => {
            segment.render(ctx, index === 0);
        });
    }
}

class CentipedeSegment {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 15;
        this.height = 15;
    }
    
    render(ctx, isHead) {
        ctx.shadowColor = '#ff00ff';
        ctx.shadowBlur = 10;
        ctx.fillStyle = isHead ? '#ff0000' : '#ff00ff';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.shadowBlur = 0;
    }
    
    collidesWith(other) {
        return this.x < other.x + other.width &&
               this.x + this.width > other.x &&
               this.y < other.y + other.height &&
               this.y + this.height > other.y;
    }
}

class Powerup {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.width = 16;
        this.height = 16;
        this.type = type;
        this.active = true;
        this.time = 0;
        this.lifespan = 15000;
        this.pulse = 0;
    }
    
    update() {
        this.time += 16;
        this.pulse += 0.2;
        
        if (this.time > this.lifespan) {
            this.active = false;
        }
    }
    
    render(ctx) {
        const scale = 1 + Math.sin(this.pulse) * 0.2;
        const size = this.width * scale;
        
        ctx.shadowColor = this.type.color;
        ctx.shadowBlur = 15;
        ctx.fillStyle = this.type.color;
        ctx.fillRect(this.x - (size - this.width) / 2, this.y - (size - this.height) / 2, size, size);
        ctx.shadowBlur = 0;
    }
    
    collidesWith(other) {
        return this.x < other.x + other.width &&
               this.x + this.width > other.x &&
               this.y < other.y + other.height &&
               this.y + this.height > other.y;
    }
}

new Game();