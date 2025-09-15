class CentipedeGame {
    constructor() {
        this.canvas = document.getElementById("gameCanvas")
        this.ctx = this.canvas.getContext("2d")
        this.width = this.canvas.width
        this.height = this.canvas.height

        this.gameState = "start"
        this.score = 0
        this.lives = 3
        this.level = 1

        this.player = {
            x: this.width / 2,
            y: this.height - 50,
            width: 20,
            height: 20,
            speed: 5,
            color: "#00ff00",
        }

        this.bullets = []
        this.centipedes = []
        this.mushrooms = []
        this.powerups = []
        this.particles = []

        this.keys = {}
        this.lastShot = 0
        this.shootCooldown = 150

        this.powerupTypes = [
            { name: "Rapid Fire", color: "#ff0000", description: "Faster shooting speed!" },
            { name: "Shield", color: "#0000ff", description: "Temporary invincibility!" },
            { name: "Extra Life", color: "#ff00ff", description: "Gain an extra life!" },
            { name: "Slowdown", color: "#ffff00", description: "Slows down centipedes!" },
            { name: "Spread Shot", color: "#00ffff", description: "Shoot multiple bullets!" },
            { name: "Piercing Shot", color: "#ff8000", description: "Bullets go through enemies!" },
            { name: "Speed Boost", color: "#80ff00", description: "Move faster!" },
            { name: "Double Points", color: "#8000ff", description: "Double score for 10 seconds!" },
            { name: "Mushroom Clear", color: "#ff0080", description: "Clears some mushrooms!" },
            { name: "Time Freeze", color: "#00ff80", description: "Freezes enemies briefly!" },
        ]

        this.activePowerups = new Map()

        this.init()
    }

    init() {
        this.setupEventListeners()
        this.generateMushrooms()
        this.spawnCentipede()
        this.gameLoop()
    }

    setupEventListeners() {
        document.addEventListener("keydown", (e) => {
            this.keys[e.code] = true

            if (e.code === "Enter" && this.gameState === "start") {
                this.startGame()
            }

            if (e.code === "Space") {
                e.preventDefault()
                this.shoot()
            }
        })

        document.addEventListener("keyup", (e) => {
            this.keys[e.code] = false
        })

        document.getElementById("restart-btn").addEventListener("click", () => {
            this.restart()
        })
    }

    startGame() {
        this.gameState = "playing"
        document.getElementById("start-screen").classList.add("hidden")
    }

    restart() {
        this.score = 0
        this.lives = 3
        this.level = 1
        this.bullets = []
        this.centipedes = []
        this.powerups = []
        this.particles = []
        this.activePowerups.clear()
        this.gameState = "playing"

        this.generateMushrooms()
        this.spawnCentipede()
        this.updateUI()

        document.getElementById("game-over-modal").classList.add("hidden")
    }

    generateMushrooms() {
        this.mushrooms = []
        const mushroomCount = 30 + this.level * 5

        for (let i = 0; i < mushroomCount; i++) {
            this.mushrooms.push({
                x: Math.random() * (this.width - 20),
                y: Math.random() * (this.height - 150) + 50,
                width: 20,
                height: 20,
                health: 4,
                maxHealth: 4,
            })
        }
    }

    spawnCentipede() {
        const segments = 10 + this.level
        const centipede = []

        for (let i = 0; i < segments; i++) {
            centipede.push({
                x: -i * 25,
                y: 50,
                width: 20,
                height: 20,
                direction: 1,
                speed: 1 + this.level * 0.2,
                isHead: i === 0,
            })
        }

        this.centipedes.push(centipede)
    }

    shoot() {
        const now = Date.now()
        const cooldown = this.activePowerups.has("Rapid Fire") ? 50 : this.shootCooldown

        if (now - this.lastShot < cooldown) return

        this.lastShot = now

        if (this.activePowerups.has("Spread Shot")) {
            for (let i = -1; i <= 1; i++) {
                this.bullets.push({
                    x: this.player.x + 10 + i * 15,
                    y: this.player.y,
                    width: 4,
                    height: 10,
                    speed: 8,
                    piercing: this.activePowerups.has("Piercing Shot"),
                })
            }
        } else {
            this.bullets.push({
                x: this.player.x + 8,
                y: this.player.y,
                width: 4,
                height: 10,
                speed: 8,
                piercing: this.activePowerups.has("Piercing Shot"),
            })
        }
    }

    update() {
        if (this.gameState !== "playing") return

        this.updatePlayer()
        this.updateBullets()
        this.updateCentipedes()
        this.updatePowerups()
        this.updateParticles()
        this.checkCollisions()
        this.updatePowerupTimers()

        if (this.centipedes.length === 0) {
            this.level++
            this.generateMushrooms()
            this.spawnCentipede()
        }
    }

    updatePlayer() {
        const speed = this.activePowerups.has("Speed Boost") ? this.player.speed * 1.5 : this.player.speed

        if (this.keys["ArrowLeft"] && this.player.x > 0) {
            this.player.x -= speed
        }
        if (this.keys["ArrowRight"] && this.player.x < this.width - this.player.width) {
            this.player.x += speed
        }
        if (this.keys["ArrowUp"] && this.player.y > this.height - 150) {
            this.player.y -= speed
        }
        if (this.keys["ArrowDown"] && this.player.y < this.height - this.player.height) {
            this.player.y += speed
        }
    }

    updateBullets() {
        this.bullets = this.bullets.filter((bullet) => {
            bullet.y -= bullet.speed
            return bullet.y > -bullet.height
        })
    }

    updateCentipedes() {
        const frozen = this.activePowerups.has("Time Freeze")
        const slowdown = this.activePowerups.has("Slowdown") ? 0.5 : 1

        this.centipedes.forEach((centipede) => {
            centipede.forEach((segment) => {
                if (frozen) return

                segment.x += segment.direction * segment.speed * slowdown

                if (segment.x <= 0 || segment.x >= this.width - segment.width) {
                    segment.direction *= -1
                    segment.y += 20
                }

                this.mushrooms.forEach((mushroom) => {
                    if (this.checkCollision(segment, mushroom)) {
                        segment.direction *= -1
                        segment.y += 20
                    }
                })

                if (segment.y >= this.height - 150) {
                    this.gameOver()
                }
            })
        })
    }

    updatePowerups() {
        this.powerups.forEach((powerup) => {
            powerup.rotation += 0.1
            powerup.scale = 1 + Math.sin(Date.now() * 0.005) * 0.2
        })
    }

    updateParticles() {
        this.particles = this.particles.filter((particle) => {
            particle.x += particle.vx
            particle.y += particle.vy
            particle.life--
            particle.alpha = particle.life / particle.maxLife
            return particle.life > 0
        })
    }

    updatePowerupTimers() {
        const now = Date.now()
        for (const [type, data] of this.activePowerups) {
            if (now > data.endTime) {
                this.activePowerups.delete(type)
            }
        }
    }

    checkCollisions() {
        this.bullets.forEach((bullet, bulletIndex) => {
            this.mushrooms.forEach((mushroom, mushroomIndex) => {
                if (this.checkCollision(bullet, mushroom)) {
                    mushroom.health--
                    if (!bullet.piercing) {
                        this.bullets.splice(bulletIndex, 1)
                    }

                    if (mushroom.health <= 0) {
                        this.score += 1
                        this.createParticles(mushroom.x + 10, mushroom.y + 10, "#8B4513")
                        this.mushrooms.splice(mushroomIndex, 1)

                        if (Math.random() < 0.3) {
                            this.spawnPowerup(mushroom.x, mushroom.y)
                        }
                    }
                }
            })

            this.centipedes.forEach((centipede, centipedeIndex) => {
                centipede.forEach((segment, segmentIndex) => {
                    if (this.checkCollision(bullet, segment)) {
                        const points = segment.isHead ? 100 : 10
                        const multiplier = this.activePowerups.has("Double Points") ? 2 : 1
                        this.score += points * multiplier

                        this.createParticles(segment.x + 10, segment.y + 10, "#00ff00")

                        if (!bullet.piercing) {
                            this.bullets.splice(bulletIndex, 1)
                        }

                        if (Math.random() < 0.4) {
                            this.spawnPowerup(segment.x, segment.y)
                        }

                        if (segmentIndex === 0 && centipede.length > 1) {
                            centipede[1].isHead = true
                        }

                        centipede.splice(segmentIndex, 1)

                        if (segmentIndex > 0 && segmentIndex < centipede.length) {
                            const newCentipede = centipede.splice(segmentIndex)
                            if (newCentipede.length > 0) {
                                newCentipede[0].isHead = true
                                this.centipedes.push(newCentipede)
                            }
                        }

                        if (centipede.length === 0) {
                            this.centipedes.splice(centipedeIndex, 1)
                        }
                    }
                })
            })
        })

        this.powerups.forEach((powerup, index) => {
            this.bullets.forEach((bullet, bulletIndex) => {
                if (this.checkCollision(bullet, powerup)) {
                    this.collectPowerup(powerup)
                    this.powerups.splice(index, 1)
                    this.bullets.splice(bulletIndex, 1)
                }
            })
        })

        if (!this.activePowerups.has("Shield")) {
            this.centipedes.forEach((centipede) => {
                centipede.forEach((segment) => {
                    if (this.checkCollision(this.player, segment)) {
                        this.playerHit()
                    }
                })
            })
        }
    }

    checkCollision(rect1, rect2) {
        return (
            rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        )
    }

    spawnPowerup(x, y) {
        const type = this.powerupTypes[Math.floor(Math.random() * this.powerupTypes.length)]
        this.powerups.push({
            x: x,
            y: y,
            width: 16,
            height: 16,
            type: type,
            rotation: 0,
            scale: 1,
        })
    }

    collectPowerup(powerup) {
        const type = powerup.type.name
        const duration = 10000

        switch (type) {
            case "Extra Life":
                this.lives++
                break
            case "Mushroom Clear":
                this.mushrooms = this.mushrooms.filter(() => Math.random() > 0.3)
                break
            default:
                this.activePowerups.set(type, {
                    endTime: Date.now() + duration,
                    type: powerup.type,
                })
        }

        this.showPowerupModal(powerup.type)
        this.createParticles(powerup.x + 8, powerup.y + 8, powerup.type.color)
    }

    showPowerupModal(powerupType) {
        const modal = document.getElementById("powerup-modal")
        const title = document.getElementById("powerup-title")
        const description = document.getElementById("powerup-description")

        title.textContent = powerupType.name
        description.textContent = powerupType.description

        modal.classList.remove("hidden")

        setTimeout(() => {
            modal.classList.add("hidden")
        }, 2000)
    }

    createParticles(x, y, color) {
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                life: 30,
                maxLife: 30,
                color: color,
                alpha: 1,
            })
        }
    }

    playerHit() {
        this.lives--
        this.createParticles(this.player.x + 10, this.player.y + 10, "#ff0000")

        if (this.lives <= 0) {
            this.gameOver()
        } else {
            this.activePowerups.set("Shield", {
                endTime: Date.now() + 2000,
                type: { name: "Shield", color: "#0000ff" },
            })
        }
    }

    gameOver() {
        this.gameState = "gameOver"
        document.getElementById("final-score").textContent = this.score
        document.getElementById("game-over-modal").classList.remove("hidden")
    }

    render() {
        this.ctx.fillStyle = "#000"
        this.ctx.fillRect(0, 0, this.width, this.height)

        if (this.gameState === "playing") {
            this.renderMushrooms()
            this.renderCentipedes()
            this.renderPlayer()
            this.renderBullets()
            this.renderPowerups()
            this.renderParticles()
            this.renderPowerupIndicators()
        }

        this.updateUI()
    }

    renderPlayer() {
        const isShielded = this.activePowerups.has("Shield")

        if (isShielded) {
            this.ctx.strokeStyle = "#0000ff"
            this.ctx.lineWidth = 3
            this.ctx.beginPath()
            this.ctx.arc(this.player.x + 10, this.player.y + 10, 15, 0, Math.PI * 2)
            this.ctx.stroke()
        }

        this.ctx.fillStyle = this.player.color
        this.ctx.shadowColor = this.player.color
        this.ctx.shadowBlur = 10
        this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height)
        this.ctx.shadowBlur = 0
    }

    renderBullets() {
        this.ctx.fillStyle = "#ffff00"
        this.ctx.shadowColor = "#ffff00"
        this.ctx.shadowBlur = 5

        this.bullets.forEach((bullet) => {
            this.ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height)
        })

        this.ctx.shadowBlur = 0
    }

    renderMushrooms() {
        this.mushrooms.forEach((mushroom) => {
            const healthRatio = mushroom.health / mushroom.maxHealth
            const red = Math.floor(255 * (1 - healthRatio))
            const green = Math.floor(139 * healthRatio)
            const blue = Math.floor(19 * healthRatio)

            this.ctx.fillStyle = `rgb(${red + 139}, ${green + 69}, ${blue + 19})`
            this.ctx.shadowColor = this.ctx.fillStyle
            this.ctx.shadowBlur = 5
            this.ctx.fillRect(mushroom.x, mushroom.y, mushroom.width, mushroom.height)
        })

        this.ctx.shadowBlur = 0
    }

    renderCentipedes() {
        this.centipedes.forEach((centipede) => {
            centipede.forEach((segment) => {
                this.ctx.fillStyle = segment.isHead ? "#ff00ff" : "#00ff00"
                this.ctx.shadowColor = this.ctx.fillStyle
                this.ctx.shadowBlur = 8
                this.ctx.fillRect(segment.x, segment.y, segment.width, segment.height)

                if (segment.isHead) {
                    this.ctx.fillStyle = "#ffffff"
                    this.ctx.fillRect(segment.x + 5, segment.y + 5, 4, 4)
                    this.ctx.fillRect(segment.x + 11, segment.y + 5, 4, 4)
                }
            })
        })

        this.ctx.shadowBlur = 0
    }

    renderPowerups() {
        this.powerups.forEach((powerup) => {
            this.ctx.save()
            this.ctx.translate(powerup.x + 8, powerup.y + 8)
            this.ctx.rotate(powerup.rotation)
            this.ctx.scale(powerup.scale, powerup.scale)

            this.ctx.fillStyle = powerup.type.color
            this.ctx.shadowColor = powerup.type.color
            this.ctx.shadowBlur = 10
            this.ctx.fillRect(-8, -8, 16, 16)

            this.ctx.restore()
        })

        this.ctx.shadowBlur = 0
    }

    renderParticles() {
        this.particles.forEach((particle) => {
            this.ctx.save()
            this.ctx.globalAlpha = particle.alpha
            this.ctx.fillStyle = particle.color
            this.ctx.fillRect(particle.x, particle.y, 2, 2)
            this.ctx.restore()
        })
    }

    renderPowerupIndicators() {
        let y = this.height - 100
        for (const [type, data] of this.activePowerups) {
            const timeLeft = (data.endTime - Date.now()) / 1000
            if (timeLeft > 0) {
                this.ctx.fillStyle = data.type.color
                this.ctx.font = "12px Orbitron"
                this.ctx.fillText(`${type}: ${timeLeft.toFixed(1)}s`, 10, y)
                y -= 15
            }
        }
    }

    updateUI() {
        document.getElementById("score").textContent = this.score
        document.getElementById("lives").textContent = this.lives
        document.getElementById("level").textContent = this.level
    }

    gameLoop() {
        this.update()
        this.render()
        requestAnimationFrame(() => this.gameLoop())
    }
}

const game = new CentipedeGame()
