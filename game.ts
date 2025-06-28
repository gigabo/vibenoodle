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

    // 3. Create particles at the current position
    if (Math.random() > 0.3) {
        particles.push(new Particle(rocket.position.x, rocket.position.y, rocket.angle, rocket.velocity));
    }

    // 4. Update and draw rocket
    rocket.update();

    // 5. Check boundaries
    if (
        rocket.position.y < -rocket.height ||
        rocket.position.y > canvas.height + rocket.height ||
        rocket.position.x < 0 ||
        rocket.position.x > canvas.width
    ) {
        rocket.reset();
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
