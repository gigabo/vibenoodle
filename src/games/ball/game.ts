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

class Polygon {
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

    drawStroke(color: string, lineWidth: number) {
        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        for (let i = 1; i < this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        ctx.closePath();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }

    // Point-in-polygon test for convex polygons
    isPointInside(point: Vector): boolean {
        const n = this.vertices.length;
        if (n < 3) return false;

        let lastSign = 0;
        for (let i = 0; i < n; i++) {
            const p1 = this.vertices[i];
            const p2 = this.vertices[(i + 1) % n];
            const d = (point.x - p1.x) * (p2.y - p1.y) - (point.y - p1.y) * (p2.x - p1.x);

            if (i === 0) {
                lastSign = Math.sign(d);
            } else {
                if (Math.sign(d) !== lastSign) {
                    return false;
                }
            }
        }
        return true;
    }
}

class Goal extends Polygon {
    pattern: CanvasPattern | null = null;

    constructor(vertices: Vector[]) {
        super(vertices, ''); // Color is not used, pattern is
        this.createPattern();
    }

    createPattern() {
        const patternCanvas = document.createElement('canvas');
        const patternCtx = patternCanvas.getContext('2d')!;
        const size = 20;
        patternCanvas.width = size * 2;
        patternCanvas.height = size * 2;

        patternCtx.fillStyle = '#333'; // Dark gray
        patternCtx.fillRect(0, 0, size, size);
        patternCtx.fillRect(size, size, size, size);
        patternCtx.fillStyle = '#111'; // Near black
        patternCtx.fillRect(size, 0, size, size);
        patternCtx.fillRect(0, size, size, size);

        this.pattern = ctx.createPattern(patternCanvas, 'repeat');
    }

    draw() {
        if (!this.pattern) return;

        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        for (let i = 1; i < this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = this.pattern;
        ctx.fill();
    }

    isBallInside(ball: Ball) {
        return this.isPointInside(ball.position);
    }
}

class Barrier extends Polygon {}

const ball = new Ball(100, GAME_HEIGHT - 100);
const initialBallState = {
    position: { x: ball.position.x, y: ball.position.y },
    velocity: { x: 0, y: 0 }
};
const effector = new Effector(GAME_WIDTH / 2, GAME_HEIGHT / 2);
const gravity: Vector = { x: 0, y: 0.5 };
let isMouseDown = false;
let mousePosition: Vector = { x: 0, y: 0 };
let isSpringSnapped = false;
let snapAnimationTimer = 0;
const SNAP_ANIMATION_DURATION = 10; // 10 frames for the snap animation

const MAX_SPRING_DISTANCE = 400;
const MAX_FORCE = 4 * gravity.y;
const SPRING_CONSTANT_K = MAX_FORCE / MAX_SPRING_DISTANCE;

let goalTimer = 3;
let isLevelComplete = false;

interface Level {
    barriers: Barrier[];
    goal: Goal;
    effectorCage: Polygon;
}

const levels: Level[] = [
    {
        barriers: [
            new Barrier([
                { x: GAME_WIDTH - 100, y: GAME_HEIGHT / 3 - 100 }, // Top-left
                { x: GAME_WIDTH - 90,  y: GAME_HEIGHT / 3 - 100 }, // Top-right of vertical arm
                { x: GAME_WIDTH - 90,  y: GAME_HEIGHT / 3 - 10 },  // Inner corner
                { x: GAME_WIDTH,       y: GAME_HEIGHT / 3 - 10 },  // Top-right of horizontal arm
                { x: GAME_WIDTH,       y: GAME_HEIGHT / 3 },       // Bottom-right
                { x: GAME_WIDTH - 100, y: GAME_HEIGHT / 3 },       // Bottom-left
            ], 'yellow')
        ],
        goal: new Goal([
            { x: GAME_WIDTH - 100, y: GAME_HEIGHT / 3 - 100 },
            { x: GAME_WIDTH, y: GAME_HEIGHT / 3 - 100 },
            { x: GAME_WIDTH, y: GAME_HEIGHT / 3 },
            { x: GAME_WIDTH - 100, y: GAME_HEIGHT / 3 },
        ]),
        effectorCage: new Polygon([
            { x: GAME_WIDTH / 2 - 100, y: GAME_HEIGHT / 2 - 100 },
            { x: GAME_WIDTH / 2 + 100, y: GAME_HEIGHT / 2 - 100 },
            { x: GAME_WIDTH / 2 + 100, y: GAME_HEIGHT / 2 + 100 },
            { x: GAME_WIDTH / 2 - 100, y: GAME_HEIGHT / 2 + 100 },
        ], '')
    },
    {
        barriers: [
            new Barrier([
                { x: GAME_WIDTH - 120, y: GAME_HEIGHT / 3 - 50 }, // Top-left
                { x: GAME_WIDTH - 110, y: GAME_HEIGHT / 3 - 50 }, // Top-right of vertical arm
                { x: GAME_WIDTH - 90,  y: GAME_HEIGHT / 3 - 10 },  // Inner corner
                { x: GAME_WIDTH,       y: GAME_HEIGHT / 3 - 10 },  // Top-right of horizontal arm
                { x: GAME_WIDTH,       y: GAME_HEIGHT / 3 },       // Bottom-right
                { x: GAME_WIDTH - 110, y: GAME_HEIGHT / 3 },       // Bottom-left
            ], 'yellow')
        ],
        goal: new Goal([
            { x: GAME_WIDTH - 120, y: GAME_HEIGHT / 3 - 50 },
            { x: GAME_WIDTH, y: GAME_HEIGHT / 3 - 50 },
            { x: GAME_WIDTH, y: GAME_HEIGHT / 3 },
            { x: GAME_WIDTH - 110, y: GAME_HEIGHT / 3 },
        ]),
        effectorCage: new Polygon([
            { x: GAME_WIDTH / 2 - 50, y: GAME_HEIGHT / 2 - 100 },
            { x: GAME_WIDTH / 2 + 50, y: GAME_HEIGHT / 2 - 100 },
            { x: GAME_WIDTH / 2 + 100, y: GAME_HEIGHT / 2 + 100 },
            { x: GAME_WIDTH / 2 - 100, y: GAME_HEIGHT / 2 + 100 },
        ], '')
    }
];

let currentLevelIndex = 0;
let currentLevel = levels[currentLevelIndex];
let barriers = currentLevel.barriers;
let goal = currentLevel.goal;
let effectorCage = currentLevel.effectorCage;

function loadLevel(levelIndex: number) {
    currentLevelIndex = levelIndex;
    if (currentLevelIndex >= levels.length) {
        currentLevelIndex = 0;
    }
    currentLevel = levels[currentLevelIndex];
    barriers = currentLevel.barriers;
    goal = currentLevel.goal;
    effectorCage = currentLevel.effectorCage;
    resetGame();
}



function resetGame() {
    ball.position.x = initialBallState.position.x;
    ball.position.y = initialBallState.position.y;
    ball.velocity.x = initialBallState.velocity.x;
    ball.velocity.y = initialBallState.velocity.y;
    goalTimer = 3;
    isLevelComplete = false;
    isSpringSnapped = false;
    snapAnimationTimer = 0;
}

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
                if (len === 0) continue;
                normal.x /= len;
                normal.y /= len;

                // Reposition the ball to the surface
                ball.position.x += normal.x * penetrationDepth;
                ball.position.y += normal.y * penetrationDepth;

                const speed = Math.sqrt(ball.velocity.x * ball.velocity.x + ball.velocity.y * ball.velocity.y);
                let timeFraction = 0;
                if (speed > 0) {
                    timeFraction = penetrationDepth / speed;
                }

                // Reflect velocity
                const dot = ball.velocity.x * normal.x + ball.velocity.y * normal.y;
                ball.velocity.x -= 2 * dot * normal.x;
                ball.velocity.y -= 2 * dot * normal.y;
                ball.velocity.x *= RESTITUTION;
                ball.velocity.y *= RESTITUTION;

                // Apply new velocity for the remainder of the frame
                ball.position.x += ball.velocity.x * timeFraction;
                ball.position.y += ball.velocity.y * timeFraction;
            }
        }
    }
}

function checkGoal() {
    if (isLevelComplete) return;

    if (goal.isBallInside(ball)) {
        goalTimer -= 1 / 60; // Assuming 60 FPS
        if (goalTimer <= 0) {
            isLevelComplete = true;
            goalTimer = 0;
        }
    } else {
        goalTimer = 3;
    }
}

let isEditMode = false;
const editModeBtn = document.getElementById('edit-mode-btn') as HTMLButtonElement;

function enterEditMode() {
    isEditMode = true;
    editModeBtn.textContent = 'Play Level';
    resetGame();
}

function exitEditMode() {
    isEditMode = false;
    editModeBtn.textContent = 'Edit Level';
    resetGame();
}

editModeBtn.addEventListener('click', () => {
    if (isEditMode) {
        exitEditMode();
    } else {
        enterEditMode();
    }
});

function gameLoop() {
    requestAnimationFrame(gameLoop);

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!isLevelComplete && !isEditMode) {
        // Update effector position
        if (effectorCage.isPointInside(mousePosition)) {
            effector.position.x = mousePosition.x;
            effector.position.y = mousePosition.y;
        } else {
            // Find the closest point on the polygon's boundary
            let closestPoint: Vector | null = null;
            let minDistanceSq = Infinity;

            for (let i = 0; i < effectorCage.vertices.length; i++) {
                const p1 = effectorCage.vertices[i];
                const p2 = effectorCage.vertices[(i + 1) % effectorCage.vertices.length];

                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const lenSq = dx * dx + dy * dy;

                const t = Math.max(0, Math.min(1, ((mousePosition.x - p1.x) * dx + (mousePosition.y - p1.y) * dy) / lenSq));
                const closestX = p1.x + t * dx;
                const closestY = p1.y + t * dy;

                const distSq = (mousePosition.x - closestX) * (mousePosition.x - closestX) + (mousePosition.y - closestY) * (mousePosition.y - closestY);

                if (distSq < minDistanceSq) {
                    minDistanceSq = distSq;
                    closestPoint = { x: closestX, y: closestY };
                }
            }
            if (closestPoint) {
                effector.position.x = closestPoint.x;
                effector.position.y = closestPoint.y;
            }
        }

        if (snapAnimationTimer > 0) {
            snapAnimationTimer--;
        }

        if (isMouseDown) {
            const dx = effector.position.x - ball.position.x;
            const dy = effector.position.y - ball.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > MAX_SPRING_DISTANCE) {
                if (!isSpringSnapped) {
                    isSpringSnapped = true;
                    snapAnimationTimer = SNAP_ANIMATION_DURATION;
                }
            }

            if (!isSpringSnapped && distance > 0) {
                const force = SPRING_CONSTANT_K * distance;
                ball.velocity.x += (dx / distance) * force;
                ball.velocity.y += (dy / distance) * force;
            }
        } else {
            isSpringSnapped = false; // Reset when mouse is released
        }

        ball.velocity.x += gravity.x;
        ball.velocity.y += gravity.y;

        ball.update();
        checkCollisions();
        checkGoal();
    } else if (isEditMode) {
        // In edit mode, we still want to be able to move the effector
        if (effectorCage.isPointInside(mousePosition)) {
            effector.position.x = mousePosition.x;
            effector.position.y = mousePosition.y;
        } else {
            // Find the closest point on the polygon's boundary
            let closestPoint: Vector | null = null;
            let minDistanceSq = Infinity;

            for (let i = 0; i < effectorCage.vertices.length; i++) {
                const p1 = effectorCage.vertices[i];
                const p2 = effectorCage.vertices[(i + 1) % effectorCage.vertices.length];

                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const lenSq = dx * dx + dy * dy;

                const t = Math.max(0, Math.min(1, ((mousePosition.x - p1.x) * dx + (mousePosition.y - p1.y) * dy) / lenSq));
                const closestX = p1.x + t * dx;
                const closestY = p1.y + t * dy;

                const distSq = (mousePosition.x - closestX) * (mousePosition.x - closestX) + (mousePosition.y - closestY) * (mousePosition.y - closestY);

                if (distSq < minDistanceSq) {
                    minDistanceSq = distSq;
                    closestPoint = { x: closestX, y: closestY };
                }
            }
            if (closestPoint) {
                effector.position.x = closestPoint.x;
                effector.position.y = closestPoint.y;
            }
        }
    }

    // --- DRAWING ---

    goal.draw();

    // Draw effector cage
    effectorCage.drawStroke('green', 1);

    for (const barrier of barriers) {
        barrier.draw();
    }

    if (isMouseDown && !isLevelComplete && !isEditMode) {
        const dx = effector.position.x - ball.position.x;
        const dy = effector.position.y - ball.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (snapAnimationTimer > 0) {
            const animationProgress = (SNAP_ANIMATION_DURATION - snapAnimationTimer) / SNAP_ANIMATION_DURATION;
            const opacity = 1 - animationProgress;
            const lineWidth = (1 + 1 * 2) * (1 + animationProgress * 4); // Start at max width and expand 5x

            const nx = dx / distance;
            const ny = dy / distance;
            const startX = effector.position.x - nx * effector.radius;
            const startY = effector.position.y - ny * effector.radius;
            const endX = ball.position.x + nx * ball.radius;
            const endY = ball.position.y + ny * ball.radius;

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        } else if (!isSpringSnapped && distance > 0) {
            const forceRatio = Math.min(distance / MAX_SPRING_DISTANCE, 1);
            const red = Math.floor(255 * forceRatio);
            const green = Math.floor(255 * (1 - forceRatio));
            const color = `rgb(${red},${green},0)`;

            const nx = dx / distance;
            const ny = dy / distance;

            const startX = effector.position.x - nx * effector.radius;
            const startY = effector.position.y - ny * effector.radius;
            const endX = ball.position.x + nx * ball.radius;
            const endY = ball.position.y + ny * ball.radius;

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1 + forceRatio * 2; // Line gets thicker too
            ctx.stroke();
        }
    }

    if (!isEditMode) {
        ball.draw();
    }
    effector.draw();

    // Draw Timer
    if (goalTimer < 3 && !isLevelComplete) {
        const timeRemaining = Math.max(0, goalTimer);
        const growthFactor = (3 - timeRemaining) / 3; // 0 -> 1
        const fontSize = 30 + (growthFactor * 30); // 30px -> 60px
        ctx.fillStyle = 'white';
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(timeRemaining.toFixed(1), GAME_WIDTH / 2, 20);
    }

    // Draw Success Message
    if (isLevelComplete) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        ctx.fillStyle = 'white';
        ctx.font = '50px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Success!', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30);

        ctx.font = '20px sans-serif';
        ctx.fillText('Click to continue', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20);
    }
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
    if (isLevelComplete) {
        loadLevel(currentLevelIndex + 1);
        return;
    }
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
    if (isLevelComplete) {
        loadLevel(currentLevelIndex + 1);
        return;
    }
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
