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
    radius: number;
    color: string;
    life: number;

    constructor(x: number, y: number, rocketAngle: number) {
        this.position = { x, y };
        const exhaustSpeed = Math.random() * 2 + 1;
        // Particles move opposite to rocket's thrust
        this.velocity = {
            x: -Math.sin(rocketAngle) * exhaustSpeed + (Math.random() - 0.5) * 1.5,
            y: Math.cos(rocketAngle) * exhaustSpeed + (Math.random() - 0.5) * 1.5
        };
        this.radius = Math.random() * 2 + 1;
        this.life = 60; // Shorter lifespan
        this.color = `rgba(255, 0, 0, 1)`;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
    }

    update() {
        this.life -= 1;
        const opacity = Math.max(0, this.life / 60);
        this.color = `rgba(255, ${opacity * 255}, 0, ${opacity})`; // Fade from red to yellow to transparent
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

function gameLoop() {
    requestAnimationFrame(gameLoop);
    ctx.fillStyle = 'black'; // Solid background
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 1. Handle input
    handleRotation();

    // 2. Apply forces
    const thrustForce: Vector = {
        x: Math.sin(rocket.angle) * rocket.thrust,
        y: -Math.cos(rocket.angle) * rocket.thrust
    };
    rocket.applyForce(thrustForce);
    rocket.applyForce(gravity);

    // 3. Update and draw rocket
    rocket.update();

    // 4. Check boundaries
    if (rocket.position.y < -rocket.height || rocket.position.x < 0 || rocket.position.x > canvas.width) {
        rocket.reset();
    }

    // 5. Create particles
    if (Math.random() > 0.3) { // More particles
        particles.push(new Particle(rocket.position.x, rocket.position.y, rocket.angle));
    }


    // 6. Update and draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

gameLoop();
