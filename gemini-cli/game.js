const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const powerupModal = document.getElementById('powerup-modal');
const powerupName = document.getElementById('powerup-name');
const powerupDescription = document.getElementById('powerup-description');

const WIDTH = 800;
const HEIGHT = 600;
canvas.width = WIDTH;
canvas.height = HEIGHT;

let gameState = 'start'; // 'start', 'playing', 'gameover'

// Game objects
let player;
let bullets;
let centipedes;
let mushrooms;
let powerUps;



// Game settings
let score;
let lives;
let level;

function init() {
    player = {
        x: WIDTH / 2 - 25,
        y: HEIGHT - 60,
        width: 50,
        height: 20,
        speed: 5,
        dx: 0,
        dy: 0
    };
    bullets = [];
    missiles = [];
    centipedes = [];
    mushrooms = [];
    powerUps = [];
    score = 0;
    lives = 3;
    level = 1;
    spawnMushrooms();
    spawnCentipede();
}

function spawnMushrooms() {
    for (let i = 0; i < 20; i++) {
        mushrooms.push({
            x: Math.random() * (WIDTH - 20),
            y: Math.random() * (HEIGHT - 100),
            width: 20,
            height: 20
        });
    }
}

function spawnCentipede() {
    const speed = 2 * level;
    const head = {
        x: WIDTH / 2,
        y: 0,
        width: 20,
        height: 20,
        dx: speed,
        dy: 0,
        originalDx: speed
    };
    centipedes.push([head]);
    for (let i = 1; i < 10; i++) {
        const segment = { ...head, x: head.x - i * 20 };
        centipedes[0].push(segment);
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function update() {
    if (gameState !== 'playing') return;

    if (shootCooldown > 0) {
        shootCooldown--;
    }

    // Move player
    player.x += player.dx;

    // Clamp player position
    if (player.x < 0) {
        player.x = 0;
    }
    if (player.x + player.width > WIDTH) {
        player.x = WIDTH - player.width;
    }

    // Move bullets
    bullets.forEach((bullet, index) => {
        bullet.y -= bullet.speed;
        bullet.x += bullet.dx;
        if (bullet.y < 0) {
            bullets.splice(index, 1);
        }
    });

    // Move missiles
    missiles.forEach((missile, index) => {
        if (!missile.target || !missile.target.x) {
            missiles.splice(index, 1);
            return;
        }
        const angle = Math.atan2(missile.target.y - missile.y, missile.target.x - missile.x);
        missile.x += Math.cos(angle) * missile.speed;
        missile.y += Math.sin(angle) * missile.speed;
    });

    if (centipedes.every(c => c.length === 0)) {
        level++;
        spawnCentipede();
    }

    // Move centipedes
    centipedes.forEach(centipede => {
        centipede.forEach(segment => {
            segment.x += segment.dx;

            if (segment.x < 0 || segment.x + segment.width > WIDTH) {
                segment.dx *= -1;
                segment.y += segment.height;
            }

            mushrooms.forEach(mushroom => {
                if (
                    segment.x < mushroom.x + mushroom.width &&
                    segment.x + segment.width > mushroom.x &&
                    segment.y < mushroom.y + mushroom.height &&
                    segment.y + segment.height > mushroom.y
                ) {
                    segment.dx *= -1;
                    segment.y += segment.height;
                }
            });
        });
    });

    // Collision detection
    handleCollisions();
}

function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    if (gameState === 'start') {
        overlay.style.display = 'flex';
    } else if (gameState === 'gameover') {
        overlay.innerHTML = `
            <div>
                <h2>Game Over</h2>
                <p>Final Score: ${score}</p>
                <p>Press Enter to Restart</p>
            </div>
        `;
        overlay.style.display = 'flex';
    } else {
        overlay.style.display = 'none';
    }

    if (gameState === 'playing') {
        // Draw player
        ctx.fillStyle = '#0f0';
        ctx.fillRect(player.x, player.y, player.width, player.height);

        if (activePowerUps['Shield']) {
            ctx.fillStyle = 'rgba(0, 0, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(player.x + player.width / 2, player.y + player.height / 2, player.width / 2 + 10, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw bullets
        ctx.fillStyle = '#f00';
        bullets.forEach(bullet => {
            ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        });

        // Draw missiles
        ctx.fillStyle = '#0f0';
        missiles.forEach(missile => {
            ctx.fillRect(missile.x, missile.y, missile.width, missile.height);
        });

        // Draw centipedes
        ctx.fillStyle = '#f0f';
        centipedes.forEach(centipede => {
            centipede.forEach(segment => {
                ctx.fillRect(segment.x, segment.y, segment.width, segment.height);
            });
        });

        // Draw mushrooms
        ctx.fillStyle = '#00f';
        mushrooms.forEach(mushroom => {
            ctx.fillRect(mushroom.x, mushroom.y, mushroom.width, mushroom.height);
        });

        // Draw power-ups
        powerUps.forEach(powerUp => {
            ctx.fillStyle = 'gold';
            ctx.fillRect(powerUp.x, powerUp.y, powerUp.width, powerUp.height);
        });

        // Draw score and lives
        ctx.fillStyle = '#fff';
        ctx.font = '20px Courier New';
        ctx.fillText(`Score: ${score}`, 10, 20);
        ctx.fillText(`Lives: ${lives}`, WIDTH - 100, 20);
    }
}

function findNearestEnemy() {
    let closestEnemy = null;
    let closestDistance = Infinity;

    centipedes.forEach(centipede => {
        centipede.forEach(segment => {
            const distance = Math.hypot(player.x - segment.x, player.y - segment.y);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestEnemy = segment;
            }
        });
    });

    mushrooms.forEach(mushroom => {
        const distance = Math.hypot(player.x - mushroom.x, player.y - mushroom.y);
        if (distance < closestDistance) {
            closestDistance = distance;
            closestEnemy = mushroom;
        }
    });

    return closestEnemy;
}

function handleCollisions() {
    // Player and power-ups
    powerUps.forEach((powerUp, index) => {
        if (
            player.x < powerUp.x + powerUp.width &&
            player.x + player.width > powerUp.x &&
            player.y < powerUp.y + powerUp.height &&
            player.y + player.height > powerUp.y
        ) {
            powerUps.splice(index, 1);
            activatePowerUp(powerUp.type);
        }
    });

    // Bullets and mushrooms
    bullets.forEach((bullet, bIndex) => {
        mushrooms.forEach((mushroom, mIndex) => {
            if (
                bullet.x < mushroom.x + mushroom.width &&
                bullet.x + bullet.width > mushroom.x &&
                bullet.y < mushroom.y + mushroom.height &&
                bullet.y + bullet.height > mushroom.y
            ) {
                if (!bullet.isLaser) {
                    bullets.splice(bIndex, 1);
                }
                mushrooms.splice(mIndex, 1);
                score += activePowerUps['Double Points'] ? 20 : 10;
                spawnPowerUp(mushroom.x, mushroom.y);
            }
        });
    });

    // Bullets and centipedes
    bullets.forEach((bullet, bIndex) => {
        centipedes.forEach((centipede, cIndex) => {
            centipede.forEach((segment, sIndex) => {
                if (
                    bullet.x < segment.x + segment.width &&
                    bullet.x + bullet.width > segment.x &&
                    bullet.y < segment.y + segment.height &&
                    bullet.y + bullet.height > segment.y
                ) {
                    if (!bullet.isLaser) {
                        bullets.splice(bIndex, 1);
                    }
                    centipede.splice(sIndex, 1);
                    score += activePowerUps['Double Points'] ? 200 : 100;
                    spawnPowerUp(segment.x, segment.y);
                    if (sIndex > 0 && sIndex < centipede.length) {
                        const newCentipede = centipede.splice(sIndex);
                        centipedes.push(newCentipede);
                    }
                }
            });
        });
    });

    // Player and centipedes
    centipedes.forEach(centipede => {
        centipede.forEach(segment => {
            if (
                player.x < segment.x + segment.width &&
                player.x + player.width > segment.x &&
                player.y < segment.y + segment.height &&
                player.y + player.height > segment.y
            ) {
                if (activePowerUps['Shield']) {
                    activePowerUps['Shield'] = false;
                } else {
                    lives--;
                    if (lives <= 0) {
                        gameState = 'gameover';
                    }
                }
            }
        });
    });

    // Missiles and enemies
    missiles.forEach((missile, mIndex) => {
        centipedes.forEach((centipede, cIndex) => {
            centipede.forEach((segment, sIndex) => {
                if (
                    missile.x < segment.x + segment.width &&
                    missile.x + missile.width > segment.x &&
                    missile.y < segment.y + segment.height &&
                    missile.y + missile.height > segment.y
                ) {
                    missiles.splice(mIndex, 1);
                    centipede.splice(sIndex, 1);
                    score += activePowerUps['Double Points'] ? 200 : 100;
                }
            });
        });

        mushrooms.forEach((mushroom, muIndex) => {
            if (
                missile.x < mushroom.x + mushroom.width &&
                missile.x + missile.width > mushroom.x &&
                missile.y < mushroom.y + mushroom.height &&
                missile.y + missile.height > mushroom.y
            ) {
                missiles.splice(mIndex, 1);
                mushrooms.splice(muIndex, 1);
                score += activePowerUps['Double Points'] ? 20 : 10;
            }
        });
    });
}

let activePowerUps = {};

function activatePowerUp(type) {
    powerupName.textContent = type.name;
    powerupDescription.textContent = type.description;
    powerupModal.classList.remove('hidden');

    setTimeout(() => {
        powerupModal.classList.add('hidden');
    }, 3000);

    switch (type.name) {
        case 'Rapid Fire':
            activePowerUps['Rapid Fire'] = true;
            setTimeout(() => {
                activePowerUps['Rapid Fire'] = false;
            }, 10000);
            break;
        case 'Shield':
            activePowerUps['Shield'] = true;
            break;
        case 'Extra Life':
            lives++;
            break;
        case 'Slowdown':
            centipedes.forEach(centipede => {
                centipede.forEach(segment => {
                    segment.dx /= 2;
                });
            });
            setTimeout(() => {
                centipedes.forEach(centipede => {
                    centipede.forEach(segment => {
                        segment.dx *= 2;
                    });
                });
            }, 5000);
            break;
        case 'Spread Shot':
            activePowerUps['Spread Shot'] = true;
            setTimeout(() => {
                activePowerUps['Spread Shot'] = false;
            }, 10000);
            break;
        case 'Bomb':
            score += mushrooms.length * 10;
            mushrooms = [];
            break;
        case 'Freeze':
            centipedes.forEach(centipede => {
                centipede.forEach(segment => {
                    segment.originalDx = segment.dx;
                    segment.dx = 0;
                });
            });
            setTimeout(() => {
                centipedes.forEach(centipede => {
                    centipede.forEach(segment => {
                        segment.dx = segment.originalDx;
                    });
                });
            }, 3000);
            break;
        case 'Double Points':
            activePowerUps['Double Points'] = true;
            setTimeout(() => {
                activePowerUps['Double Points'] = false;
            }, 10000);
            break;
        case 'Laser':
            activePowerUps['Laser'] = true;
            setTimeout(() => {
                activePowerUps['Laser'] = false;
            }, 5000);
            break;
        case 'Homing Missiles':
            activePowerUps['Homing Missiles'] = true;
            setTimeout(() => {
                activePowerUps['Homing Missiles'] = false;
            }, 10000);
            break;
    }
}

function spawnPowerUp(x, y) {
    const powerUpTypes = [
        { name: 'Rapid Fire', description: 'Increases your firing rate.' },
        { name: 'Shield', description: 'Protects you from one hit.' },
        { name: 'Extra Life', description: 'Grants an extra life.' },
        { name: 'Slowdown', description: 'Slows down all centipedes.' },
        { name: 'Spread Shot', description: 'Shoots three bullets at once.' },
        { name: 'Bomb', description: 'Destroys all mushrooms.' },
        { name: 'Freeze', description: 'Freezes all centipedes for a short time.' },
        { name: 'Double Points', description: 'Doubles your score for a short time.' },
        { name: 'Laser', description: 'A powerful laser that pierces through enemies.' },
        { name: 'Homing Missiles', description: 'Missiles that seek out enemies.' },
    ];
    const type = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
    powerUps.push({ x, y, width: 20, height: 20, type });
}

let shootCooldown = 0;

// Event listeners
document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && gameState !== 'playing') {
        if (gameState === 'gameover') {
            overlay.innerHTML = `
            <div id="controls">
                <h2>Controls</h2>
                <p>Move: Arrow Keys</p>
                <p>Shoot: Spacebar</p>
            </div>
            <div id="start-game">
                <p>Press Enter to Start</p>
            </div>
        `;
        }
        gameState = 'playing';
        init();
    }

    if (gameState === 'playing') {
        if (e.key === 'ArrowLeft') {
            player.dx = -player.speed;
        } else if (e.key === 'ArrowRight') {
            player.dx = player.speed;
        } else if (e.key === ' ' && shootCooldown <= 0) {
            if (activePowerUps['Spread Shot']) {
                bullets.push({
                    x: player.x + player.width / 2 - 2.5,
                    y: player.y,
                    width: 5,
                    height: 10,
                    speed: 7,
                    dx: 0
                });
                bullets.push({
                    x: player.x + player.width / 2 - 2.5,
                    y: player.y,
                    width: 5,
                    height: 10,
                    speed: 7,
                    dx: -1
                });
                bullets.push({
                    x: player.x + player.width / 2 - 2.5,
                    y: player.y,
                    width: 5,
                    height: 10,
                    speed: 7,
                    dx: 1
                });
            } else if (activePowerUps['Homing Missiles']) {
                let target = findNearestEnemy();
                if (target) {
                    missiles.push({
                        x: player.x + player.width / 2 - 2.5,
                        y: player.y,
                        width: 5,
                        height: 10,
                        speed: 5,
                        target: target
                    });
                } else {
                    bullets.push({
                        x: player.x + player.width / 2 - 2.5,
                        y: player.y,
                        width: 5,
                        height: 10,
                        speed: 7,
                        dx: 0
                    });
                }
            } else if (activePowerUps['Laser']) {
                bullets.push({
                    x: player.x + player.width / 2 - 2.5,
                    y: player.y,
                    width: 5,
                    height: HEIGHT,
                    speed: 20,
                    dx: 0,
                    isLaser: true
                });
            } else {
                bullets.push({
                    x: player.x + player.width / 2 - 2.5,
                    y: player.y,
                    width: 5,
                    height: 10,
                    speed: 7,
                    dx: 0
                });
            }
            shootCooldown = activePowerUps['Rapid Fire'] ? 10 : 30;
        }
    }
});

document.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        player.dx = 0;
    }
});

init();
gameLoop();
