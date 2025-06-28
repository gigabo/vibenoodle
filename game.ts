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
    width: number;
    height: number;

    constructor() {
        this.position = { x: canvas.width / 2, y: canvas.height - 30 };
        this.velocity = { x: 0, y: -2 };
        this.width = 4;
        this.height = 20;
    }

    draw() {
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.moveTo(this.position.x, this.position.y);
        ctx.lineTo(this.position.x, this.position.y - this.height);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = this.width;
        ctx.stroke();
    }

    update() {
        this.position.x += this.velocity.x;
        this.draw();
    }
}

class Particle {
    position: Vector;
    velocity: Vector;
    radius: number;
    color: string;
    life: number;

    constructor(x: number, y: number) {
        this.position = { x, y };
        this.velocity = { x: (Math.random() - 0.5) * 2, y: Math.random() * 3 + 1 };
        this.radius = Math.random() * 2 + 1;
        this.life = 100;
        this.color = `rgba(255, 0, 0, ${this.life / 100})`;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
    }

    update() {
        this.life -= 1;
        this.color = `rgba(255, 0, 0, ${Math.max(0, this.life / 100)})`;
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
        this.draw();
    }
}

const rocket = new Rocket();
const particles: Particle[] = [];

const keys: { [key: string]: boolean } = {
    ArrowLeft: false,
    ArrowRight: false,
};

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = false;
    }
});

function handleMovement() {
    if (keys.ArrowLeft) {
        rocket.velocity.x = -5;
    } else if (keys.ArrowRight) {
        rocket.velocity.x = 5;
    } else {
        rocket.velocity.x = 0;
    }
}

function gameLoop() {
    requestAnimationFrame(gameLoop);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    rocket.update();
    handleMovement();

    // Add new particles
    if (Math.random() < 0.5) {
        particles.push(new Particle(rocket.position.x, rocket.position.y));
    }

    // Update and draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

gameLoop();
