const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

interface Vector {
    x: number;
    y: number;
}

class Rocket {
    position: Vector;
    velocity: Vector;
    acceleration: Vector;
    width: number;
    height: number;
    thrust: number;
    angle: number;

    constructor() {
        this.position = { x: canvas.width / 2, y: canvas.height - 30 };
        this.velocity = { x: 0, y: 0 };
        this.acceleration = { x: 0, y: 0 };
        this.width = 4;
        this.height = 20;
        this.thrust = 0.15;
        this.angle = 0;
    }

    reset() {
        this.position = { x: canvas.width / 2, y: canvas.height - 30 };
        this.velocity = { x: 0, y: 0 };
        this.acceleration = { x: 0, y: 0 };
        this.angle = 0;
    }

    applyForce(force: Vector) {
        this.acceleration.x += force.x;
        this.acceleration.y += force.y;
    }

    draw() {
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.angle);

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -this.height);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = this.width;
        ctx.stroke();

        ctx.restore();
    }

    update() {
        this.velocity.x += this.acceleration.x;
        this.velocity.y += this.acceleration.y;
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
        this.acceleration = { x: 0, y: 0 }; // Clear acceleration
        this.draw();
    }
}

class Particle {
    position: Vector;
    velocity: Vector;
    length: number;
    color: string;
    life: number;
    maxLife: number;
    angle: number;

    constructor(x: number, y: number, rocketAngle: number, rocketVelocity: Vector) {
        this.position = { x, y };
        const spread = (Math.random() - 0.5) * (Math.PI / 6); // 30 degrees in radians
        const angle = rocketAngle + spread;
        const exhaustSpeed = Math.random() * 5 + 3;

        this.velocity = {
            x: rocketVelocity.x - Math.sin(angle) * exhaustSpeed,
            y: rocketVelocity.y + Math.cos(angle) * exhaustSpeed
        };
        this.angle = Math.atan2(this.velocity.y, this.velocity.x);
        this.length = Math.random() * 5 + 2;
        this.maxLife = 60;
        this.life = this.maxLife;
        this.color = 'rgba(255, 100, 0, 1)'; // Start as bright red-orange
    }

    draw() {
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-this.length, 0);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    update() {
        this.life -= 1;

        this.velocity.x *= 0.97;
        this.velocity.y *= 0.97;

        const progress = this.life / this.maxLife;
        const red = 255;
        const green = Math.round(100 * progress);
        const opacity = Math.max(0, progress);
        this.color = `rgba(${red}, ${green}, 0, ${opacity})`;

        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
        this.draw();
    }
}

class Target {
    position: Vector;
    velocity: Vector;
    radius: number;

    constructor() {
        this.position = { x: Math.random() * canvas.width, y: -30 };
        const angle = (Math.random() - 0.5) * (Math.PI / 3); // -30 to +30 degrees
        const speed = 1;
        this.velocity = {
            x: Math.sin(angle) * speed,
            y: Math.cos(angle) * speed
        };
        this.radius = 30;

        // Adjust starting position to ensure it doesn't go off-screen
        const timeToBottom = (canvas.height + this.radius) / this.velocity.y;
        const finalX = this.position.x + this.velocity.x * timeToBottom;

        if (finalX < 0) {
            this.position.x = -this.velocity.x * timeToBottom;
        } else if (finalX > canvas.width) {
            this.position.x = canvas.width - this.velocity.x * timeToBottom;
        }
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    update() {
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
        this.draw();
    }
}

class Explosion {
    position: Vector;
    radius: number;
    maxRadius: number;
    speed: number;
    generation: number;
    color: string;

    constructor(x: number, y: number, generation: number) {
        this.position = { x, y };
        this.radius = 1;
        this.generation = generation;
        this.maxRadius = 200 * Math.pow(0.8, this.generation - 1);
        this.speed = 1.5;

        const colors = ['red', 'orange', 'yellow', 'white'];
        this.color = colors[(this.generation - 1) % colors.length];
    }

    draw() {
        const opacity = 1 - this.radius / this.maxRadius;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.colorToRgb(this.color)}, ${opacity})`;
        ctx.fill();
    }

    colorToRgb(color: string): string {
        switch (color) {
            case 'red': return '255, 0, 0';
            case 'orange': return '255, 165, 0';
            case 'yellow': return '255, 255, 0';
            case 'white': return '255, 255, 255';
            default: return '255, 0, 0';
        }
    }

    update() {
        this.radius += this.speed;
        this.draw();
    }
}

class BonusText {
    position: Vector;
    velocity: Vector;
    text: string;
    life: number;
    maxLife: number;

    constructor(x: number, y: number, text: string) {
        this.position = { x, y };
        this.velocity = { x: 0, y: -1 };
        this.text = text;
        this.maxLife = 60;
        this.life = this.maxLife;
    }

    draw() {
        const opacity = this.life / this.maxLife;
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.font = '20px Arial';
        ctx.fillText(this.text, this.position.x, this.position.y);
    }

    update() {
        this.position.y += this.velocity.y;
        this.life -= 1;
        this.draw();
    }
}

const rocket = new Rocket();
const particles: Particle[] = [];
const targets: Target[] = [];
const explosions: Explosion[] = [];
const bonusTexts: BonusText[] = [];
let score = 0;
let lastTargetTime = 0;
const initialTargetSpawnInterval = 3000;
let targetSpawnInterval = initialTargetSpawnInterval;
let gameState: 'playing' | 'gameOver' = 'playing';

const keys: { [key: string]: boolean } = {
    ArrowLeft: false,
    ArrowRight: false,
    ' ': false,
};

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        e.preventDefault();
        keys[e.key] = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        e.preventDefault();
        keys[e.key] = false;
    }
});

const gravity: Vector = { x: 0, y: 0.05 };
const rotationSpeed = 0.05;

function handleRotation() {
    if (keys.ArrowLeft) {
        rocket.angle -= rotationSpeed;
    }
    if (keys.ArrowRight) {
        rocket.angle += rotationSpeed;
    }
}

function checkCollisions() {
    // Rocket with targets
    for (let i = targets.length - 1; i >= 0; i--) {
        const target = targets[i];
        const dx = rocket.position.x - target.position.x;
        const dy = rocket.position.y - target.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < target.radius + rocket.height / 2) {
            bonusTexts.push(new BonusText(target.position.x, target.position.y, 'x1'));
            explosions.push(new Explosion(target.position.x, target.position.y, 1));
            targets.splice(i, 1);
            score++;
            targetSpawnInterval *= 0.99;
        }
    }

    // Explosions with targets
    for (let i = explosions.length - 1; i >= 0; i--) {
        const explosion = explosions[i];
        for (let j = targets.length - 1; j >= 0; j--) {
            const target = targets[j];
            const dx = explosion.position.x - target.position.x;
            const dy = explosion.position.y - target.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < explosion.radius + target.radius) {
                const bonus = Math.pow(2, explosion.generation);
                bonusTexts.push(new BonusText(target.position.x, target.position.y, `x${bonus}`));
                explosions.push(new Explosion(target.position.x, target.position.y, explosion.generation + 1));
                targets.splice(j, 1);
                score += bonus;
                targetSpawnInterval *= 0.99;
            }
        }
    }
}

function drawScore() {
    ctx.fillStyle = 'white';
    ctx.font = '24px Arial';
    ctx.fillText(`Score: ${score}`, 20, 40);
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'white';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2 - 60);

    ctx.font = '36px Arial';
    ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2);

    ctx.font = '24px Arial';
    ctx.fillText('Press Space to Play Again', canvas.width / 2, canvas.height / 2 + 60);
    ctx.textAlign = 'left';
}

function resetGame() {
    rocket.reset();
    particles.length = 0;
    targets.length = 0;
    explosions.length = 0;
    bonusTexts.length = 0;
    score = 0;
    lastTargetTime = 0;
    targetSpawnInterval = initialTargetSpawnInterval;
    gameState = 'playing';
}

function gameLoop(currentTime: number) {
    requestAnimationFrame(gameLoop);

    if (gameState === 'gameOver') {
        if (keys[' ']) {
            resetGame();
        }
        drawGameOver();
        return;
    }

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Spawn new targets
    if (currentTime - lastTargetTime > targetSpawnInterval) {
        lastTargetTime = currentTime;
        targets.push(new Target());
    }

    handleRotation();

    const thrustForce: Vector = {
        x: Math.sin(rocket.angle) * rocket.thrust,
        y: -Math.cos(rocket.angle) * rocket.thrust
    };
    rocket.applyForce(thrustForce);
    rocket.applyForce(gravity);

    if (Math.random() > 0.3) {
        particles.push(new Particle(rocket.position.x, rocket.position.y, rocket.angle, rocket.velocity));
    }

    rocket.update();
    checkCollisions();

    if (
        rocket.position.y < -rocket.height ||
        rocket.position.y > canvas.height + rocket.height ||
        rocket.position.x < 0 ||
        rocket.position.x > canvas.width
    ) {
        rocket.reset();
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }

    for (let i = targets.length - 1; i >= 0; i--) {
        const t = targets[i];
        t.update();
        if (t.position.y > canvas.height + t.radius) {
            gameState = 'gameOver';
        }
    }

    for (let i = explosions.length - 1; i >= 0; i--) {
        const e = explosions[i];
        e.update();
        if (e.radius >= e.maxRadius) {
            explosions.splice(i, 1);
        }
    }

    for (let i = bonusTexts.length - 1; i >= 0; i--) {
        const bt = bonusTexts[i];
        bt.update();
        if (bt.life <= 0) {
            bonusTexts.splice(i, 1);
        }
    }

    drawScore();
}

gameLoop(0);
