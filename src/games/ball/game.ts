export {};

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const RESTITUTION = 0.8;

canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

function resizeCanvas() {
    const wrapper = document.querySelector('.game-wrapper') as HTMLElement;
    const container = document.querySelector('.game-container') as HTMLElement;
    if (!wrapper || !container) return;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    const scaleX = windowWidth / GAME_WIDTH;
    const scaleY = windowHeight / GAME_HEIGHT;
    const scale = Math.min(scaleX, scaleY);

    const newWidth = GAME_WIDTH * scale;
    const newHeight = GAME_HEIGHT * scale;

    container.style.width = `${newWidth + 20}px`;
    container.style.height = `${newHeight + 20}px`;
    canvas.style.width = `${newWidth}px`;
    canvas.style.height = `${newHeight}px`;
}

window.addEventListener('resize', resizeCanvas);

interface Vector {
    x: number;
    y: number;
}

class Ball {
    position: Vector;
    velocity: Vector;
    radius: number;
    color: string;

    constructor(x: number, y: number) {
        this.position = { x, y };
        this.velocity = { x: 0, y: 0 };
        this.radius = 20;
        this.color = 'blue';
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    update() {
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
    }
}

class Effector {
    position: Vector;
    radius: number;
    color: string;

    constructor(x: number, y: number) {
        this.position = { x, y };
        this.radius = 10;
        this.color = 'darkgreen';
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

class Barrier {
    vertices: Vector[];
    color: string;

    constructor(vertices: Vector[], color: string) {
        this.vertices = vertices;
        this.color = color;
    }

    draw() {
        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        for (let i = 1; i < this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}

const ball = new Ball(100, GAME_HEIGHT - 100);
const effector = new Effector(GAME_WIDTH / 2, GAME_HEIGHT / 2);
const gravity: Vector = { x: 0, y: 0.5 };
let isMouseDown = false;
let mousePosition: Vector = { x: 0, y: 0 };

const effectorCage = {
    x: GAME_WIDTH / 2 - 100,
    y: GAME_HEIGHT / 2 - 100,
    width: 200,
    height: 200,
};

const barriers: Barrier[] = [
    new Barrier([
        { x: GAME_WIDTH - 100, y: GAME_HEIGHT / 3 - 100 }, // Top-left
        { x: GAME_WIDTH - 90,  y: GAME_HEIGHT / 3 - 100 }, // Top-right of vertical arm
        { x: GAME_WIDTH - 90,  y: GAME_HEIGHT / 3 - 10 },  // Inner corner
        { x: GAME_WIDTH,       y: GAME_HEIGHT / 3 - 10 },  // Top-right of horizontal arm
        { x: GAME_WIDTH,       y: GAME_HEIGHT / 3 },       // Bottom-right
        { x: GAME_WIDTH - 100, y: GAME_HEIGHT / 3 },       // Bottom-left
    ], 'yellow')
];

function checkCollisions() {
    // Canvas bounds
    if (ball.position.x + ball.radius > GAME_WIDTH) {
        ball.velocity.x *= -RESTITUTION;
        ball.position.x = GAME_WIDTH - ball.radius;
    }
    if (ball.position.x - ball.radius < 0) {
        ball.velocity.x *= -RESTITUTION;
        ball.position.x = ball.radius;
    }
    if (ball.position.y + ball.radius > GAME_HEIGHT) {
        ball.velocity.y *= -RESTITUTION;
        ball.position.y = GAME_HEIGHT - ball.radius;
    }
    if (ball.position.y - ball.radius < 0) {
        ball.velocity.y *= -RESTITUTION;
        ball.position.y = ball.radius;
    }

    // Barriers
    for (const barrier of barriers) {
        for (let i = 0; i < barrier.vertices.length; i++) {
            const p1 = barrier.vertices[i];
            const p2 = barrier.vertices[(i + 1) % barrier.vertices.length];

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const lenSq = dx * dx + dy * dy;

            const t = Math.max(0, Math.min(1, ((ball.position.x - p1.x) * dx + (ball.position.y - p1.y) * dy) / lenSq));
            const closestX = p1.x + t * dx;
            const closestY = p1.y + t * dy;

            const distSq = (ball.position.x - closestX) * (ball.position.x - closestX) + (ball.position.y - closestY) * (ball.position.y - closestY);

            if (distSq < ball.radius * ball.radius) {
                const penetrationDepth = ball.radius - Math.sqrt(distSq);
                const normal = { x: ball.position.x - closestX, y: ball.position.y - closestY };
                const len = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
                normal.x /= len;
                normal.y /= len;

                ball.position.x += normal.x * penetrationDepth;
                ball.position.y += normal.y * penetrationDepth;

                const dot = ball.velocity.x * normal.x + ball.velocity.y * normal.y;
                ball.velocity.x -= 2 * dot * normal.x;
                ball.velocity.y -= 2 * dot * normal.y;
                ball.velocity.x *= RESTITUTION;
                ball.velocity.y *= RESTITUTION;
            }
        }
    }
}

function gameLoop() {
    requestAnimationFrame(gameLoop);

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Update effector position
    effector.position.x = Math.max(effectorCage.x + effector.radius, Math.min(effectorCage.x + effectorCage.width - effector.radius, mousePosition.x));
    effector.position.y = Math.max(effectorCage.y + effector.radius, Math.min(effectorCage.y + effectorCage.height - effector.radius, mousePosition.y));

    if (isMouseDown) {
        const dx = effector.position.x - ball.position.x;
        const dy = effector.position.y - ball.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 0) {
            const force = 2 * gravity.y;
            ball.velocity.x += (dx / distance) * force;
            ball.velocity.y += (dy / distance) * force;
        }
    }

    ball.velocity.x += gravity.x;
    ball.velocity.y += gravity.y;

    checkCollisions();
    ball.update();

    // Draw effector cage
    ctx.strokeStyle = 'green';
    ctx.strokeRect(effectorCage.x, effectorCage.y, effectorCage.width, effectorCage.height);

    for (const barrier of barriers) {
        barrier.draw();
    }

    if (isMouseDown) {
        const dx = effector.position.x - ball.position.x;
        const dy = effector.position.y - ball.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 0) {
            const nx = dx / distance;
            const ny = dy / distance;

            const startX = effector.position.x - nx * effector.radius;
            const startY = effector.position.y - ny * effector.radius;
            const endX = ball.position.x + nx * ball.radius;
            const endY = ball.position.y + ny * ball.radius;

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    ball.draw();
    effector.draw();
}

function getMousePos(evt: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (evt.clientX - rect.left) * scaleX,
        y: (evt.clientY - rect.top) * scaleY,
    };
}

canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    mousePosition = getMousePos(e);
});

canvas.addEventListener('mouseup', () => {
    isMouseDown = false;
});

canvas.addEventListener('mousemove', (e) => {
    mousePosition = getMousePos(e);
});

canvas.addEventListener('touchstart', (e) => {
    isMouseDown = true;
    mousePosition = getMousePos(e.touches[0] as any);
});

canvas.addEventListener('touchend', () => {
    isMouseDown = false;
});

canvas.addEventListener('touchmove', (e) => {
    if (isMouseDown) {
        mousePosition = getMousePos(e.touches[0] as any);
    }
});

function setupFullscreen() {
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    if (!fullscreenBtn) return;

    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            document.exitFullscreen();
        }
    });
}

resizeCanvas();
setupFullscreen();
gameLoop();