const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startOverlay = document.getElementById('startOverlay');
const controlsOverlay = document.getElementById('controlsOverlay');
const powerUpModal = document.getElementById('powerUpModal');
const powerUpDescription = document.getElementById('powerUpDescription');

const WIDTH = 800;
const HEIGHT = 600;
const PLAYER_SPEED = 5;
const BULLET_SPEED = 10;
const CENTIPEDE_SPEED = 2;
const SEGMENT_SIZE = 20;
const MUSHROOM_SIZE = 20;
const POWERUP_SIZE = 20;
const POWERUP_TYPES = [
    { name: 'Rapid Fire', effect: 'fireRate', value: 0.5, color: '#ff0000' },
    { name: 'Shield', effect: 'shield', value: 1, color: '#00ff00' },
    { name: 'Extra Life', effect: 'life', value: 1, color: '#0000ff' },
    { name: 'Slowdown', effect: 'slowdown', value: 0.5, color: '#ffff00' },
    { name: 'Spread Shot', effect: 'spread', value: 1, color: '#ff00ff' },
    { name: 'Multi Shot', effect: 'multi', value: 1, color: '#00ffff' },
    { name: 'Poison', effect: 'poison', value: 1, color: '#800080' },
    { name: 'Freeze', effect: 'freeze', value: 1, color: '#008080' },
    { name: 'Score Multiplier', effect: 'scoreMult', value: 2, color: '#808000' },
    { name: 'Invincible', effect: 'invincible', value: 1, color: '#ff8000' }
];

class Player {
    constructor() {
        this.x = WIDTH / 2;
        this.y = HEIGHT - 50;
        this.width = 20;
        this.height = 20;
        this.speed = PLAYER_SPEED;
        this.bullets = [];
        this.fireRate = 10;
        this.lastShot = 0;
        this.shield = 0;
        this.invincible = 0;
        this.spread = 0;
        this.multi = 0;
    }
    update(keys) {
        if (keys.ArrowLeft && this.x > 0) this.x -= this.speed;
        if (keys.ArrowRight && this.x < WIDTH - this.width) this.x += this.speed;
        if (keys.ArrowUp && this.y > HEIGHT / 2) this.y -= this.speed;
        if (keys.ArrowDown && this.y < HEIGHT - this.height) this.y += this.speed;
        if (keys[' '] && Date.now() - this.lastShot > this.fireRate) {
            this.shoot();
            this.lastShot = Date.now();
        }
        this.bullets.forEach(b => b.update());
        this.bullets = this.bullets.filter(b => b.y > 0);
        if (this.invincible > 0) this.invincible--;
        if (this.shield > 0) this.shield--;
    }
    shoot() {
        if (this.spread > 0) {
            this.bullets.push(new Bullet(this.x + this.width / 2 - 5, this.y, -BULLET_SPEED, -1));
            this.bullets.push(new Bullet(this.x + this.width / 2 - 5, this.y, -BULLET_SPEED, 0));
            this.bullets.push(new Bullet(this.x + this.width / 2 - 5, this.y, -BULLET_SPEED, 1));
        } else {
            this.bullets.push(new Bullet(this.x + this.width / 2 - 5, this.y));
        }
        if (this.multi > 0) {
            this.bullets.push(new Bullet(this.x + this.width / 2 - 5, this.y, -BULLET_SPEED, -2));
            this.bullets.push(new Bullet(this.x + this.width / 2 - 5, this.y, -BULLET_SPEED, 2));
        }
    }
    render() {
        ctx.fillStyle = this.invincible > 0 ? '#ffff00' : '#00ff00';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        this.bullets.forEach(b => b.render());
    }
}

class Bullet {
    constructor(x, y, dy = -BULLET_SPEED, dx = 0) {
        this.x = x;
        this.y = y;
        this.width = 10;
        this.height = 10;
        this.dx = dx;
        this.dy = dy;
    }
    update() {
        this.x += this.dx;
        this.y += this.dy;
    }
    render() {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

class CentipedeSegment {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = SEGMENT_SIZE;
        this.height = SEGMENT_SIZE;
        this.dx = CENTIPEDE_SPEED;
        this.dy = 0;
        this.alive = true;
    }
    update() {
        this.x += this.dx;
        this.y += this.dy;
        if (this.x <= 0 || this.x >= WIDTH - this.width) {
            this.dx = -this.dx;
            this.y += SEGMENT_SIZE;
        }
    }
    render() {
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

class Mushroom {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = MUSHROOM_SIZE;
        this.height = MUSHROOM_SIZE;
        this.health = 4;
    }
    render() {
        ctx.fillStyle = `hsl(${this.health * 30}, 100%, 50%)`;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.width = POWERUP_SIZE;
        this.height = POWERUP_SIZE;
        this.type = type;
        this.color = type.color;
        this.dy = 2;
    }
    update() {
        this.y += this.dy;
    }
    render() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

class Game {
    constructor() {
        this.player = new Player();
        this.centipede = [];
        this.mushrooms = [];
        this.powerUps = [];
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.gameState = 'start';
        this.keys = {};
        this.init();
    }
    init() {
        this.spawnMushrooms();
        this.spawnCentipede();
    }
    spawnMushrooms() {
        for (let i = 0; i < 50; i++) {
            let x = Math.random() * (WIDTH - MUSHROOM_SIZE);
            let y = Math.random() * (HEIGHT / 2) + HEIGHT / 4;
            this.mushrooms.push(new Mushroom(x, y));
        }
    }
    spawnCentipede() {
        this.centipede = [];
        for (let i = 0; i < 10; i++) {
            this.centipede.push(new CentipedeSegment(i * SEGMENT_SIZE, 0));
        }
    }
    update() {
        if (this.gameState !== 'playing') return;
        this.player.update(this.keys);
        this.centipede.forEach(s => s.update());
        this.powerUps.forEach(p => p.update());
        this.powerUps = this.powerUps.filter(p => p.y < HEIGHT);
        this.checkCollisions();
        if (this.centipede.length === 0) {
            this.level++;
            this.spawnCentipede();
        }
        if (this.centipede.some(s => s.y >= HEIGHT - SEGMENT_SIZE)) {
            this.gameOver();
        }
    }
    checkCollisions() {
        this.player.bullets.forEach(b => {
            this.centipede.forEach((s, i) => {
                if (this.collides(b, s)) {
                    b.y = -10;
                    s.alive = false;
                    this.score += 10;
                    if (Math.random() < 0.1) {
                        let type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
                        this.powerUps.push(new PowerUp(s.x, s.y, type));
                    }
                    if (i > 0) this.centipede.splice(i, 0, new CentipedeSegment(s.x, s.y));
                }
            });
            this.mushrooms.forEach(m => {
                if (this.collides(b, m)) {
                    b.y = -10;
                    m.health--;
                    if (m.health <= 0) {
                        this.mushrooms.splice(this.mushrooms.indexOf(m), 1);
                        if (Math.random() < 0.05) {
                            let type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
                            this.powerUps.push(new PowerUp(m.x, m.y, type));
                        }
                    }
                }
            });
            this.powerUps.forEach(p => {
                if (this.collides(b, p)) {
                    b.y = -10;
                    this.collectPowerUp(p);
                }
            });
        });
        this.centipede.forEach(s => {
            if (this.collides(this.player, s) && this.player.invincible === 0) {
                this.lives--;
                if (this.lives <= 0) this.gameOver();
                else this.player.x = WIDTH / 2;
            }
        });
    }
    collides(a, b) {
        return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    }
    collectPowerUp(p) {
        this.powerUps.splice(this.powerUps.indexOf(p), 1);
        powerUpDescription.textContent = p.type.name + ': ' + p.type.effect;
        powerUpModal.style.display = 'flex';
        this.gameState = 'paused';
        setTimeout(() => {
            powerUpModal.style.display = 'none';
            this.gameState = 'playing';
        }, 3000);
        switch (p.type.effect) {
            case 'fireRate': this.player.fireRate = Math.max(5, this.player.fireRate - p.type.value); break;
            case 'shield': this.player.shield += p.type.value; break;
            case 'life': this.lives += p.type.value; break;
            case 'slowdown': CENTIPEDE_SPEED *= p.type.value; break;
            case 'spread': this.player.spread += p.type.value; break;
            case 'multi': this.player.multi += p.type.value; break;
            case 'poison': this.centipede.forEach(s => s.alive = false); break;
            case 'freeze': this.centipede.forEach(s => s.dx = 0); setTimeout(() => this.centipede.forEach(s => s.dx = CENTIPEDE_SPEED), 5000); break;
            case 'scoreMult': this.score *= p.type.value; break;
            case 'invincible': this.player.invincible += 300; break;
        }
    }
    gameOver() {
        this.gameState = 'gameover';
    }
    render() {
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        this.mushrooms.forEach(m => m.render());
        this.centipede.forEach(s => s.render());
        this.powerUps.forEach(p => p.render());
        this.player.render();
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Score: ' + this.score, 10, 20);
        ctx.fillText('Lives: ' + this.lives, 10, 40);
        ctx.fillText('Level: ' + this.level, 10, 60);
        if (this.gameState === 'gameover') {
            ctx.fillStyle = '#ff0000';
            ctx.fillText('Game Over', WIDTH / 2 - 50, HEIGHT / 2);
        }
    }
}

const game = new Game();

function loop() {
    game.update();
    game.render();
    requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
    game.keys[e.key] = true;
    if (e.key === ' ') e.preventDefault();
    if (game.gameState === 'start' && e.key === ' ') {
        game.gameState = 'playing';
        startOverlay.style.display = 'none';
        controlsOverlay.style.display = 'none';
    }
});

document.addEventListener('keyup', e => {
    delete game.keys[e.key];
});

loop();