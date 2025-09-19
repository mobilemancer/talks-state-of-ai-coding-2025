class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        
        this.gameState = 'start';
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.lastTime = 0;
        
        this.keys = {};
        this.player = null;
        this.bullets = [];
        this.centipedes = [];
        this.mushrooms = [];
        this.powerUps = [];
        this.activePowerUps = [];
        
        this.setupEventListeners();
        this.initializeGame();
        this.gameLoop();
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'Enter') {
                if (this.gameState === 'start') {
                    this.startGame();
                } else if (this.gameState === 'gameOver') {
                    this.resetGame();
                }
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }
    
    initializeGame() {
        this.player = new Player(this.width / 2, this.height - 50);
        this.generateMushrooms();
    }
    
    startGame() {
        this.gameState = 'playing';
        document.getElementById('startScreen').classList.add('hidden');
        this.spawnCentipede();
    }
    
    resetGame() {
        this.gameState = 'start';
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.bullets = [];
        this.centipedes = [];
        this.powerUps = [];
        this.activePowerUps = [];
        this.player = new Player(this.width / 2, this.height - 50);
        this.generateMushrooms();
        this.updateUI();
        document.getElementById('gameOverScreen').classList.add('hidden');
        document.getElementById('startScreen').classList.remove('hidden');
    }
    
    generateMushrooms() {
        this.mushrooms = [];
        const mushroomCount = 30 + this.level * 5;
        for (let i = 0; i < mushroomCount; i++) {
            const x = Math.random() * (this.width - 20);
            const y = Math.random() * (this.height - 150) + 50;
            this.mushrooms.push(new Mushroom(x, y));
        }
    }
    
    spawnCentipede() {
        const segments = 10 + this.level;
        const centipede = new Centipede(0, 50, segments, this.level);
        this.centipedes.push(centipede);
    }
    
    update(deltaTime) {
        if (this.gameState !== 'playing') return;
        
        this.player.update(this.keys, deltaTime);
        
        if (this.keys['Space'] && this.player.canShoot()) {
            const newBullets = this.player.shoot();
            if (Array.isArray(newBullets)) {
                this.bullets.push(...newBullets);
            } else {
                this.bullets.push(newBullets);
            }
        }
        
        this.bullets.forEach(bullet => bullet.update(deltaTime));
        this.bullets = this.bullets.filter(bullet => bullet.y > 0);
        
        this.centipedes.forEach(centipede => centipede.update(deltaTime, this.mushrooms, this.width, this.height));
        
        this.powerUps.forEach(powerUp => {
            powerUp.update(deltaTime);
            if (this.player.magnet) {
                const dx = this.player.x - powerUp.x;
                const dy = this.player.y - powerUp.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 100) {
                    powerUp.x += (dx / distance) * 100 * deltaTime / 1000;
                    powerUp.y += (dy / distance) * 100 * deltaTime / 1000;
                }
            }
        });
        this.powerUps = this.powerUps.filter(powerUp => powerUp.y < this.height);
        
        this.updatePowerUps(deltaTime);
        this.checkCollisions();
        this.checkGameConditions();
    }
    
    updatePowerUps(deltaTime) {
        this.activePowerUps.forEach(powerUp => {
            powerUp.duration -= deltaTime;
            if (powerUp.duration <= 0) {
                powerUp.deactivate(this.player);
            }
        });
        this.activePowerUps = this.activePowerUps.filter(powerUp => powerUp.duration > 0);
    }
    
    checkCollisions() {
        // Bullet vs Mushroom collisions
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            for (let j = this.mushrooms.length - 1; j >= 0; j--) {
                const mushroom = this.mushrooms[j];
                if (this.isColliding(bullet, mushroom)) {
                    if (!bullet.piercing) {
                        this.bullets.splice(i, 1);
                    }
                    if (mushroom.takeDamage()) {
                        this.mushrooms.splice(j, 1);
                        this.score += (this.player.doubleScore ? 2 : 1);
                        if (Math.random() < 0.3) {
                            const powerUpType = PowerUp.getRandomType();
                            this.powerUps.push(new PowerUp(mushroom.x, mushroom.y, powerUpType));
                        }
                    }
                    if (!bullet.piercing) break;
                }
            }
        }

        // Bullet vs Centipede collisions
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            let bulletHit = false;
            for (let c = 0; c < this.centipedes.length; c++) {
                const centipede = this.centipedes[c];
                for (let s = centipede.segments.length - 1; s >= 0; s--) {
                    const segment = centipede.segments[s];
                    if (this.isColliding(bullet, segment)) {
                        if (!bullet.piercing) {
                            this.bullets.splice(i, 1);
                            bulletHit = true;
                        }
                        this.score += (this.player.doubleScore ? 20 : 10);

                        if (Math.random() < 0.2) {
                            const powerUpType = PowerUp.getRandomType();
                            this.powerUps.push(new PowerUp(segment.x, segment.y, powerUpType));
                        }

                        const newCentipede = centipede.split(s);
                        if (newCentipede) {
                            this.centipedes.push(newCentipede);
                        }

                        centipede.removeSegment(s);
                        if (centipede.segments.length === 0) {
                            this.centipedes.splice(c, 1);
                            c--;
                        }
                        if (!bullet.piercing) break;
                    }
                }
                if (bulletHit) break;
            }
        }

        // Player vs PowerUp collisions
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const powerUp = this.powerUps[i];
            if (this.isColliding(this.player, powerUp)) {
                powerUp.activate(this.player, this);
                this.powerUps.splice(i, 1);
            }
        }

        // Player vs Centipede collisions
        if (!this.player.shield) {
            for (let centipede of this.centipedes) {
                for (let segment of centipede.segments) {
                    if (this.isColliding(this.player, segment)) {
                        this.lives--;
                        this.player.x = this.width / 2;
                        this.player.y = this.height - 50;
                        break;
                    }
                }
            }
        }

        // Check if centipede reached bottom
        for (let centipede of this.centipedes) {
            for (let segment of centipede.segments) {
                if (segment.y >= this.height - 100) {
                    this.lives--;
                    this.player.x = this.width / 2;
                    this.player.y = this.height - 50;
                    break;
                }
            }
        }
    }

    isColliding(obj1, obj2) {
        return obj1.x < obj2.x + obj2.width &&
               obj1.x + obj1.width > obj2.x &&
               obj1.y < obj2.y + obj2.height &&
               obj1.y + obj1.height > obj2.y;
    }
    
    checkGameConditions() {
        if (this.lives <= 0) {
            this.gameOver();
        }
        
        if (this.centipedes.length === 0) {
            this.level++;
            this.spawnCentipede();
            this.generateMushrooms();
        }
    }
    
    gameOver() {
        this.gameState = 'gameOver';
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOverScreen').classList.remove('hidden');
    }
    
    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('lives').textContent = this.lives;
        document.getElementById('level').textContent = this.level;
        
        const powerUpContainer = document.getElementById('activePowerUps');
        powerUpContainer.innerHTML = '';
        this.activePowerUps.forEach(powerUp => {
            const icon = document.createElement('div');
            icon.className = 'power-up-icon';
            icon.style.backgroundColor = powerUp.color;
            icon.style.borderColor = powerUp.color;
            icon.textContent = powerUp.symbol;
            powerUpContainer.appendChild(icon);
        });
    }
    
    render() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        if (this.gameState === 'playing') {
            this.mushrooms.forEach(mushroom => mushroom.render(this.ctx));
            this.bullets.forEach(bullet => bullet.render(this.ctx));
            this.centipedes.forEach(centipede => centipede.render(this.ctx));
            this.powerUps.forEach(powerUp => powerUp.render(this.ctx));
            this.player.render(this.ctx);
        }
    }
    
    gameLoop(currentTime = 0) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        this.update(deltaTime);
        this.render();
        this.updateUI();
        
        requestAnimationFrame((time) => this.gameLoop(time));
    }
}

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 20;
        this.speed = 200;
        this.lastShot = 0;
        this.shootCooldown = 200;
        this.rapidFire = false;
        this.shield = false;
        this.spreadShot = false;
        this.piercingShot = false;
        this.explosiveShot = false;
        this.magnet = false;
        this.doubleScore = false;
    }

    update(keys, deltaTime) {
        if (keys['ArrowLeft'] && this.x > 0) {
            this.x -= this.speed * deltaTime / 1000;
        }
        if (keys['ArrowRight'] && this.x < 800 - this.width) {
            this.x += this.speed * deltaTime / 1000;
        }
        if (keys['ArrowUp'] && this.y > 400) {
            this.y -= this.speed * deltaTime / 1000;
        }
        if (keys['ArrowDown'] && this.y < 600 - this.height) {
            this.y += this.speed * deltaTime / 1000;
        }

        this.lastShot += deltaTime;
    }

    canShoot() {
        const cooldown = this.rapidFire ? 100 : this.shootCooldown;
        return this.lastShot >= cooldown;
    }

    shoot() {
        this.lastShot = 0;
        const bullets = [];

        if (this.spreadShot) {
            bullets.push(new Bullet(this.x + this.width / 2 - 5, this.y, -0.3));
            bullets.push(new Bullet(this.x + this.width / 2, this.y, 0));
            bullets.push(new Bullet(this.x + this.width / 2 + 5, this.y, 0.3));
        } else {
            bullets.push(new Bullet(this.x + this.width / 2, this.y, 0));
        }

        bullets.forEach(bullet => {
            bullet.piercing = this.piercingShot;
            bullet.explosive = this.explosiveShot;
        });

        return bullets;
    }

    render(ctx) {
        ctx.fillStyle = this.shield ? '#ffff00' : '#00ffff';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = this.shield ? 15 : 10;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.shadowBlur = 0;
    }
}

class Bullet {
    constructor(x, y, angle = 0) {
        this.x = x;
        this.y = y;
        this.width = 3;
        this.height = 8;
        this.speed = 400;
        this.angle = angle;
        this.piercing = false;
        this.explosive = false;
        this.hit = false;
    }

    update(deltaTime) {
        this.y -= this.speed * deltaTime / 1000;
        this.x += Math.sin(this.angle) * this.speed * deltaTime / 1000;
    }

    render(ctx) {
        let color = '#ffff00';
        if (this.piercing) color = '#8800ff';
        if (this.explosive) color = '#ff4400';

        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = this.explosive ? 8 : 5;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.shadowBlur = 0;
    }
}

class Mushroom {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 15;
        this.height = 15;
        this.health = 4;
        this.maxHealth = 4;
    }

    takeDamage() {
        this.health--;
        return this.health <= 0;
    }

    render(ctx) {
        const healthRatio = this.health / this.maxHealth;
        ctx.fillStyle = `hsl(${120 * healthRatio}, 100%, 50%)`;
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 5;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.shadowBlur = 0;
    }
}

class CentipedeSegment {
    constructor(x, y, isHead = false) {
        this.x = x;
        this.y = y;
        this.width = 15;
        this.height = 15;
        this.isHead = isHead;
        this.direction = 1;
        this.speed = 50;
        this.dropDistance = 20;
    }

    render(ctx) {
        ctx.fillStyle = this.isHead ? '#ff00ff' : '#ff0080';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 8;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.shadowBlur = 0;
    }
}

class Centipede {
    constructor(x, y, segmentCount, level) {
        this.segments = [];
        this.speed = 50 + level * 10;
        this.direction = 1;
        this.frozen = false;

        for (let i = 0; i < segmentCount; i++) {
            const segment = new CentipedeSegment(x - i * 20, y, i === 0);
            segment.speed = this.speed;
            this.segments.push(segment);
        }
    }

    update(deltaTime, mushrooms, canvasWidth, canvasHeight) {
        if (this.segments.length === 0 || this.frozen) return;

        const head = this.segments[0];
        const moveDistance = this.speed * deltaTime / 1000;

        let shouldDrop = false;
        const nextX = head.x + this.direction * moveDistance;

        if (nextX <= 0 || nextX >= canvasWidth - head.width) {
            shouldDrop = true;
        }

        for (let mushroom of mushrooms) {
            if (this.checkCollision(head, mushroom, nextX, head.y)) {
                shouldDrop = true;
                break;
            }
        }

        if (shouldDrop) {
            this.direction *= -1;
            this.segments.forEach(segment => {
                segment.y += segment.dropDistance;
                segment.direction = this.direction;
            });
        } else {
            this.segments.forEach((segment, index) => {
                if (index === 0) {
                    segment.x = nextX;
                } else {
                    const prevSegment = this.segments[index - 1];
                    const dx = prevSegment.x - segment.x;
                    const dy = prevSegment.y - segment.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance > 20) {
                        segment.x += (dx / distance) * moveDistance;
                        segment.y += (dy / distance) * moveDistance;
                    }
                }
            });
        }
    }

    checkCollision(segment, mushroom, newX, newY) {
        return newX < mushroom.x + mushroom.width &&
               newX + segment.width > mushroom.x &&
               newY < mushroom.y + mushroom.height &&
               newY + segment.height > mushroom.y;
    }

    removeSegment(index) {
        this.segments.splice(index, 1);
        if (this.segments.length > 0 && index === 0) {
            this.segments[0].isHead = true;
        }
    }

    split(index) {
        if (index <= 0 || index >= this.segments.length) return null;

        const newSegments = this.segments.splice(index);
        if (newSegments.length > 0) {
            newSegments[0].isHead = true;
            const newCentipede = new Centipede(0, 0, 0, 1);
            newCentipede.segments = newSegments;
            newCentipede.speed = this.speed;
            newCentipede.direction = this.direction;
            return newCentipede;
        }
        return null;
    }

    render(ctx) {
        this.segments.forEach(segment => segment.render(ctx));
    }
}

class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.width = 12;
        this.height = 12;
        this.type = type;
        this.speed = 30;
        this.animationTime = 0;

        this.setupType();
    }

    setupType() {
        const types = {
            rapidFire: { color: '#ff0000', symbol: 'R', name: 'Rapid Fire', description: 'Faster shooting speed' },
            shield: { color: '#0000ff', symbol: 'S', name: 'Shield', description: 'Temporary invincibility' },
            extraLife: { color: '#00ff00', symbol: 'L', name: 'Extra Life', description: 'Gain an extra life' },
            slowDown: { color: '#ffff00', symbol: 'T', name: 'Time Slow', description: 'Slows down centipedes' },
            spreadShot: { color: '#ff8800', symbol: 'M', name: 'Multi-Shot', description: 'Shoot multiple bullets' },
            piercing: { color: '#8800ff', symbol: 'P', name: 'Piercing Shot', description: 'Bullets go through enemies' },
            explosive: { color: '#ff4400', symbol: 'E', name: 'Explosive Shot', description: 'Bullets explode on impact' },
            magnet: { color: '#00ffff', symbol: 'G', name: 'Magnet', description: 'Attracts power-ups' },
            doubleScore: { color: '#ffaa00', symbol: 'D', name: 'Double Score', description: 'Double points for a while' },
            freeze: { color: '#aaffff', symbol: 'F', name: 'Freeze', description: 'Freezes all centipedes' },
            nuke: { color: '#ffffff', symbol: 'N', name: 'Nuke', description: 'Destroys all mushrooms' },
            speedBoost: { color: '#ff00aa', symbol: 'B', name: 'Speed Boost', description: 'Move faster' }
        };

        const typeData = types[this.type];
        this.color = typeData.color;
        this.symbol = typeData.symbol;
        this.name = typeData.name;
        this.description = typeData.description;
    }

    update(deltaTime) {
        this.y += this.speed * deltaTime / 1000;
        this.animationTime += deltaTime;
    }

    activate(player, game) {
        const duration = 5000;

        switch(this.type) {
            case 'rapidFire':
                player.rapidFire = true;
                this.addToActive(game, duration, () => player.rapidFire = false);
                break;
            case 'shield':
                player.shield = true;
                this.addToActive(game, duration, () => player.shield = false);
                break;
            case 'extraLife':
                game.lives++;
                break;
            case 'slowDown':
                game.centipedes.forEach(c => c.speed *= 0.5);
                this.addToActive(game, duration, () => {
                    game.centipedes.forEach(c => c.speed *= 2);
                });
                break;
            case 'spreadShot':
                player.spreadShot = true;
                this.addToActive(game, duration, () => player.spreadShot = false);
                break;
            case 'piercing':
                player.piercingShot = true;
                this.addToActive(game, duration, () => player.piercingShot = false);
                break;
            case 'explosive':
                player.explosiveShot = true;
                this.addToActive(game, duration, () => player.explosiveShot = false);
                break;
            case 'magnet':
                player.magnet = true;
                this.addToActive(game, duration, () => player.magnet = false);
                break;
            case 'doubleScore':
                player.doubleScore = true;
                this.addToActive(game, duration, () => player.doubleScore = false);
                break;
            case 'freeze':
                game.centipedes.forEach(c => c.frozen = true);
                this.addToActive(game, 3000, () => {
                    game.centipedes.forEach(c => c.frozen = false);
                });
                break;
            case 'nuke':
                game.mushrooms = [];
                break;
            case 'speedBoost':
                player.speed *= 1.5;
                this.addToActive(game, duration, () => player.speed /= 1.5);
                break;
        }

        this.showModal(game);
    }

    addToActive(game, duration, deactivateFunc) {
        const activePowerUp = {
            type: this.type,
            color: this.color,
            symbol: this.symbol,
            duration: duration,
            deactivate: deactivateFunc
        };

        const existing = game.activePowerUps.find(p => p.type === this.type);
        if (existing) {
            existing.duration = duration;
        } else {
            game.activePowerUps.push(activePowerUp);
        }
    }

    showModal(game) {
        const modal = document.getElementById('powerUpModal');
        const nameEl = document.getElementById('powerUpName');
        const descEl = document.getElementById('powerUpDescription');

        nameEl.textContent = this.name;
        descEl.textContent = this.description;
        modal.classList.remove('hidden');

        setTimeout(() => {
            modal.classList.add('hidden');
        }, 2000);
    }

    render(ctx) {
        const pulse = Math.sin(this.animationTime / 200) * 0.3 + 0.7;
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10 * pulse;

        ctx.fillRect(this.x, this.y, this.width, this.height);

        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText(this.symbol, this.x + this.width/2, this.y + this.height - 2);

        ctx.shadowBlur = 0;
    }

    static getRandomType() {
        const types = ['rapidFire', 'shield', 'extraLife', 'slowDown', 'spreadShot',
                      'piercing', 'explosive', 'magnet', 'doubleScore', 'freeze', 'nuke', 'speedBoost'];
        return types[Math.floor(Math.random() * types.length)];
    }
}

const game = new Game();
