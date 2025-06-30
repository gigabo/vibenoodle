export {};

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

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

    // Bounce off walls with restitution
    if (ball.position.x + ball.radius > GAME_WIDTH) {
        ball.velocity.x *= -0.9;
        ball.position.x = GAME_WIDTH - ball.radius;
    }
    if (ball.position.x - ball.radius < 0) {
        ball.velocity.x *= -0.9;
        ball.position.x = ball.radius;
    }
    if (ball.position.y + ball.radius > GAME_HEIGHT) {
        ball.velocity.y *= -0.9;
        ball.position.y = GAME_HEIGHT - ball.radius;
    }
    if (ball.position.y - ball.radius < 0) {
        ball.velocity.y *= -0.9;
        ball.position.y = ball.radius;
    }

    ball.update();

    // Draw effector cage
    ctx.strokeStyle = 'green';
    ctx.strokeRect(effectorCage.x, effectorCage.y, effectorCage.width, effectorCage.height);

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