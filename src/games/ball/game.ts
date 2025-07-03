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

class Barrier extends Polygon {
    constructor(vertices: Vector[]) {
        super(vertices, 'yellow');
    }
}

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
    goals: Goal[];
    effectorCages: Polygon[];
}

let levels: Level[] = [];
let currentLevelIndex = 0;
let currentLevel: Level;
let barriers: Barrier[];
let goals: Goal[];
let effectorCages: Polygon[];
let hoveredPolygon: Polygon | null = null;
let selectedPolygon: Polygon | null = null;
let hoveredVertexIndex: number | null = null;
let draggedVertexIndex: number | null = null;
let isDraggingVertex = false;
let hoveredEdgeInfo: { polygon: Polygon, edgeIndex: number, closestPoint: Vector } | null = null;
let mouseDownPos: Vector | null = null;
let draggedDistance = 0;
let addModePolygonType: 'barrier' | 'cage' | 'goal' | null = null;
let newPolygonVertices: Vector[] = [];
let hoveredSuccessButton: 'replay' | 'next' | null = null;

const addBarrierBtn = document.getElementById('add-barrier-btn') as HTMLButtonElement;
const addCageBtn = document.getElementById('add-cage-btn') as HTMLButtonElement;
const addGoalBtn = document.getElementById('add-goal-btn') as HTMLButtonElement;

async function loadLevels() {
    try {
        const response = await fetch('/games/ball/levels.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const levelsData = await response.json();

        levels = levelsData.map((levelData: any) => {
            const parseVertices = (verts: [number, number][]): Vector[] => verts.map(v => ({ x: v[0], y: v[1] }));
            return {
                barriers: levelData.barriers.map((b: any) => new Barrier(parseVertices(b.vertices))),
                goals: levelData.goals.map((g: any) => new Goal(parseVertices(g.vertices))),
                effectorCages: levelData.effectorCages.map((c: any) => new Polygon(parseVertices(c.vertices), ''))
            };
        });

        loadLevel(0);
        gameLoop(); // Start the game loop only after levels are loaded
    } catch (error) {
        console.error("Could not load levels:", error);
    }
}


function loadLevel(levelIndex: number) {
    currentLevelIndex = levelIndex;
    if (currentLevelIndex >= levels.length) {
        currentLevelIndex = 0;
    }
    currentLevel = levels[currentLevelIndex];
    barriers = currentLevel.barriers;
    goals = currentLevel.goals;
    effectorCages = currentLevel.effectorCages;
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
    selectedPolygon = null;
    hoveredPolygon = null;
    hoveredVertexIndex = null;
    draggedVertexIndex = null;
    isDraggingVertex = false;
    hoveredEdgeInfo = null;
    addModePolygonType = null;
    newPolygonVertices = [];
    updateAddButtons();
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

    let inGoal = false;
    for (const goal of goals) {
        if (goal.isBallInside(ball)) {
            inGoal = true;
            break;
        }
    }

    if (inGoal) {
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
const showJsonBtn = document.getElementById('show-json-btn') as HTMLButtonElement;
const jsonModal = document.getElementById('json-modal') as HTMLDivElement;
const jsonPre = document.getElementById('json-pre') as HTMLPreElement;
const closeBtn = document.querySelector('.close-btn') as HTMLSpanElement;

function enterEditMode() {
    isEditMode = true;
    editModeBtn.textContent = 'Play Level';
    showJsonBtn.style.display = 'inline-block';
    addBarrierBtn.style.display = 'inline-block';
    addCageBtn.style.display = 'inline-block';
    addGoalBtn.style.display = 'inline-block';
    resetGame();
}

function exitEditMode() {
    isEditMode = false;
    editModeBtn.textContent = 'Edit Level';
    showJsonBtn.style.display = 'none';
    addBarrierBtn.style.display = 'none';
    addCageBtn.style.display = 'none';
    addGoalBtn.style.display = 'none';
    resetGame();
}

function updateAddButtons() {
    addBarrierBtn.classList.toggle('active', addModePolygonType === 'barrier');
    addCageBtn.classList.toggle('active', addModePolygonType === 'cage');
    addGoalBtn.classList.toggle('active', addModePolygonType === 'goal');
}

addBarrierBtn.addEventListener('click', () => {
    addModePolygonType = addModePolygonType === 'barrier' ? null : 'barrier';
    newPolygonVertices = [];
    updateAddButtons();
});

addCageBtn.addEventListener('click', () => {
    addModePolygonType = addModePolygonType === 'cage' ? null : 'cage';
    newPolygonVertices = [];
    updateAddButtons();
});

addGoalBtn.addEventListener('click', () => {
    addModePolygonType = addModePolygonType === 'goal' ? null : 'goal';
    newPolygonVertices = [];
    updateAddButtons();
});

editModeBtn.addEventListener('click', () => {
    if (isEditMode) {
        exitEditMode();
    } else {
        enterEditMode();
    }
});

showJsonBtn.addEventListener('click', () => {
    const formatVertices = (verts: Vector[]) => verts.map(v => [v.x, v.y]);
    const levelJson = {
        barriers: currentLevel.barriers.map(b => ({
            vertices: formatVertices(b.vertices)
        })),
        goals: currentLevel.goals.map(g => ({
            vertices: formatVertices(g.vertices)
        })),
        effectorCages: currentLevel.effectorCages.map(c => ({
            vertices: formatVertices(c.vertices)
        }))
    };

    // Custom stringification to keep vertex arrays on one line
    const placeholders = new Map<string, string>();
    let placeholderIndex = 0;

    const replacer = (key: string, value: any) => {
        if (key === 'vertices') {
            return value.map((vertex: [number, number]) => {
                const placeholder = `%%VERTEX_${placeholderIndex++}%%`;
                placeholders.set(placeholder, `[${vertex[0]}, ${vertex[1]}]`);
                return placeholder;
            });
        }
        return value;
    };

    let jsonString = JSON.stringify(levelJson, replacer, 2);

    for (const [placeholder, vertexString] of placeholders.entries()) {
        jsonString = jsonString.replace(`"${placeholder}"`, vertexString);
    }

    jsonPre.textContent = jsonString;
    jsonModal.style.display = 'block';
});

closeBtn.addEventListener('click', () => {
    jsonModal.style.display = 'none';
});

window.addEventListener('click', (event) => {
    if (event.target == jsonModal) {
        jsonModal.style.display = 'none';
    }
});

    function gameLoop() {
    requestAnimationFrame(gameLoop);

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Always update effector position if level is not complete
    if (!isLevelComplete) {
        let closestCage: Polygon | null = null;
        let minDistanceSq = Infinity;

        for (const cage of effectorCages) {
            if (cage.isPointInside(mousePosition)) {
                closestCage = cage;
                break;
            }

            for (let i = 0; i < cage.vertices.length; i++) {
                const p1 = cage.vertices[i];
                const p2 = cage.vertices[(i + 1) % cage.vertices.length];
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const lenSq = dx * dx + dy * dy;
                const t = Math.max(0, Math.min(1, ((mousePosition.x - p1.x) * dx + (mousePosition.y - p1.y) * dy) / lenSq));
                const closestX = p1.x + t * dx;
                const closestY = p1.y + t * dy;
                const distSq = (mousePosition.x - closestX) * (mousePosition.x - closestX) + (mousePosition.y - closestY) * (mousePosition.y - closestY);

                if (distSq < minDistanceSq) {
                    minDistanceSq = distSq;
                    closestCage = cage;
                }
            }
        }

        if (closestCage) {
            if (closestCage.isPointInside(mousePosition)) {
                effector.position.x = mousePosition.x;
                effector.position.y = mousePosition.y;
            } else {
                let closestPointOnBoundary: Vector | null = null;
                let minBoundaryDistSq = Infinity;

                for (let i = 0; i < closestCage.vertices.length; i++) {
                    const p1 = closestCage.vertices[i];
                    const p2 = closestCage.vertices[(i + 1) % closestCage.vertices.length];
                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;
                    const lenSq = dx * dx + dy * dy;
                    const t = Math.max(0, Math.min(1, ((mousePosition.x - p1.x) * dx + (mousePosition.y - p1.y) * dy) / lenSq));
                    const closestX = p1.x + t * dx;
                    const closestY = p1.y + t * dy;
                    const distSq = (mousePosition.x - closestX) * (mousePosition.x - closestX) + (mousePosition.y - closestY) * (mousePosition.y - closestY);

                    if (distSq < minBoundaryDistSq) {
                        minBoundaryDistSq = distSq;
                        closestPointOnBoundary = { x: closestX, y: closestY };
                    }
                }
                if (closestPointOnBoundary) {
                    effector.position.x = closestPointOnBoundary.x;
                    effector.position.y = closestPointOnBoundary.y;
                }
            }
        }
    }

    // Handle game physics and interactions only in play mode
    if (!isLevelComplete && !isEditMode) {
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
    }

    if (isEditMode) {
        if (addModePolygonType) {
            // Draw preview of new polygon
            if (newPolygonVertices.length > 0) {
                ctx.beginPath();
                ctx.moveTo(newPolygonVertices[0].x, newPolygonVertices[0].y);
                for (let i = 1; i < newPolygonVertices.length; i++) {
                    ctx.lineTo(newPolygonVertices[i].x, newPolygonVertices[i].y);
                }
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.lineTo(mousePosition.x, mousePosition.y);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.stroke();
            }

            for (let i = 0; i < newPolygonVertices.length; i++) {
                const vertex = newPolygonVertices[i];
                ctx.beginPath();
                ctx.arc(vertex.x, vertex.y, 4, 0, Math.PI * 2);
                let color = 'white';
                if (i === 0) {
                    const dx = mousePosition.x - vertex.x;
                    const dy = mousePosition.y - vertex.y;
                    if (dx * dx + dy * dy < 8 * 8) {
                        color = 'blue';
                    }
                }
                ctx.fillStyle = color;
                ctx.fill();
            }

            if (newPolygonVertices.length === 0) {
                ctx.beginPath();
                ctx.arc(mousePosition.x, mousePosition.y, 4, 0, Math.PI * 2);
                ctx.strokeStyle = 'blue';
                ctx.stroke();
            }
        } else {
            const allPolygons = [...goals, ...barriers, ...effectorCages];
            let topPolygon: Polygon | null = null;
            for (const polygon of allPolygons) {
                if (polygon.isPointInside(mousePosition)) {
                    topPolygon = polygon;
                }
            }
            hoveredPolygon = topPolygon;

            hoveredVertexIndex = null;
            hoveredEdgeInfo = null;

            if (selectedPolygon) {
                // Check for hovering over vertices
                for (let i = 0; i < selectedPolygon.vertices.length; i++) {
                    const vertex = selectedPolygon.vertices[i];
                    const dx = mousePosition.x - vertex.x;
                    const dy = mousePosition.y - vertex.y;
                    if (dx * dx + dy * dy < 8 * 8) { // 8px radius for hover detection
                        hoveredVertexIndex = i;
                        break;
                    }
                }

                // If not hovering over a vertex, check for hovering over edges
                if (hoveredVertexIndex === null) {
                    let minDistanceSq = Infinity;
                    for (let i = 0; i < selectedPolygon.vertices.length; i++) {
                        const p1 = selectedPolygon.vertices[i];
                        const p2 = selectedPolygon.vertices[(i + 1) % selectedPolygon.vertices.length];
                        const dx = p2.x - p1.x;
                        const dy = p2.y - p1.y;
                        const lenSq = dx * dx + dy * dy;
                        const t = Math.max(0, Math.min(1, ((mousePosition.x - p1.x) * dx + (mousePosition.y - p1.y) * dy) / lenSq));
                        const closestPoint = { x: p1.x + t * dx, y: p1.y + t * dy };
                        const distSq = (mousePosition.x - closestPoint.x) * (mousePosition.x - closestPoint.x) + (mousePosition.y - closestPoint.y) * (mousePosition.y - closestPoint.y);

                        if (distSq < 10 * 10 && distSq < minDistanceSq) { // 10px tolerance for edge hover
                            minDistanceSq = distSq;
                            hoveredEdgeInfo = { polygon: selectedPolygon, edgeIndex: i, closestPoint: { x: Math.round(closestPoint.x), y: Math.round(closestPoint.y) } };
                        }
                    }
                }
            }
        }
    } else {
        hoveredPolygon = null;
        hoveredVertexIndex = null;
        hoveredEdgeInfo = null;
    }

    // --- DRAWING ---

    for (const goal of goals) {
        goal.draw();
    }
    for (const cage of effectorCages) {
        cage.drawStroke('green', 1);
    }
    for (const barrier of barriers) {
        barrier.draw();
    }

    if (isEditMode) {
        if (hoveredPolygon && !addModePolygonType) {
            hoveredPolygon.drawStroke('rgba(255, 255, 255, 0.5)', 4);
        }
        if (selectedPolygon && !addModePolygonType) {
            selectedPolygon.drawStroke('rgba(255, 255, 255, 1)', 2);
            for (let i = 0; i < selectedPolygon.vertices.length; i++) {
                const vertex = selectedPolygon.vertices[i];
                const radius = (hoveredVertexIndex === i) ? 8 : 4;
                ctx.beginPath();
                ctx.arc(vertex.x, vertex.y, radius, 0, Math.PI * 2);
                ctx.fillStyle = 'white';
                ctx.fill();
            }

            if (hoveredEdgeInfo) {
                const { closestPoint } = hoveredEdgeInfo;
                ctx.beginPath();
                ctx.arc(closestPoint.x, closestPoint.y, 8, 0, Math.PI * 2);
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
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
        effector.draw();
    }

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
        ctx.fillText('Success!', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60);

        // Define button areas
        const replayButton = { x: GAME_WIDTH / 2 - 150, y: GAME_HEIGHT / 2, width: 120, height: 40 };
        const nextButton = { x: GAME_WIDTH / 2 + 30, y: GAME_HEIGHT / 2, width: 120, height: 40 };

        // Check for hover
        hoveredSuccessButton = null;
        if (mousePosition.x >= replayButton.x && mousePosition.x <= replayButton.x + replayButton.width &&
            mousePosition.y >= replayButton.y && mousePosition.y <= replayButton.y + replayButton.height) {
            hoveredSuccessButton = 'replay';
        } else if (mousePosition.x >= nextButton.x && mousePosition.x <= nextButton.x + nextButton.width &&
                   mousePosition.y >= nextButton.y && mousePosition.y <= nextButton.y + nextButton.height) {
            hoveredSuccessButton = 'next';
        }

        // Draw buttons
        ctx.font = '20px sans-serif';
        ctx.fillStyle = hoveredSuccessButton === 'replay' ? 'lightblue' : 'white';
        ctx.fillRect(replayButton.x, replayButton.y, replayButton.width, replayButton.height);
        ctx.fillStyle = 'black';
        ctx.fillText('Replay', replayButton.x + replayButton.width / 2, replayButton.y + 25);

        ctx.fillStyle = hoveredSuccessButton === 'next' ? 'lightblue' : 'white';
        ctx.fillRect(nextButton.x, nextButton.y, nextButton.width, nextButton.height);
        ctx.fillStyle = 'black';
        ctx.fillText('Next Level', nextButton.x + nextButton.width / 2, nextButton.y + 25);
    }
}

function getMousePos(evt: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: Math.round((evt.clientX - rect.left) * scaleX),
        y: Math.round((evt.clientY - rect.top) * scaleY),
    };
}

canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    mousePosition = getMousePos(e);
    mouseDownPos = mousePosition;
    draggedDistance = 0;

    if (isEditMode) {
        if (addModePolygonType) {
            if (newPolygonVertices.length > 0) {
                const firstVertex = newPolygonVertices[0];
                const dx = mousePosition.x - firstVertex.x;
                const dy = mousePosition.y - firstVertex.y;
                if (dx * dx + dy * dy < 8 * 8) {
                    // Complete the polygon
                    switch (addModePolygonType) {
                        case 'barrier':
                            barriers.push(new Barrier(newPolygonVertices));
                            break;
                        case 'cage':
                            effectorCages.push(new Polygon(newPolygonVertices, ''));
                            break;
                        case 'goal':
                            goals.push(new Goal(newPolygonVertices));
                            break;
                    }
                    addModePolygonType = null;
                    newPolygonVertices = [];
                    updateAddButtons();
                } else {
                    newPolygonVertices.push(mousePosition);
                }
            } else {
                newPolygonVertices.push(mousePosition);
            }
        } else if (selectedPolygon && hoveredVertexIndex !== null) {
            isDraggingVertex = true;
            draggedVertexIndex = hoveredVertexIndex;
        } else if (selectedPolygon && hoveredEdgeInfo) {
            const { polygon, edgeIndex, closestPoint } = hoveredEdgeInfo;
            polygon.vertices.splice(edgeIndex + 1, 0, closestPoint);
            isDraggingVertex = true;
            draggedVertexIndex = edgeIndex + 1;
        }
    }
});

canvas.addEventListener('mouseup', () => {
    isMouseDown = false;

    if (isLevelComplete) {
        if (hoveredSuccessButton === 'replay') {
            loadLevel(currentLevelIndex);
        } else if (hoveredSuccessButton === 'next') {
            loadLevel(currentLevelIndex + 1);
        }
        return;
    }

    if (isEditMode) {
        if (draggedDistance < 5 && !addModePolygonType) {
            // Prioritize vertex click for deletion
            if (hoveredVertexIndex !== null && selectedPolygon) {
                if (selectedPolygon.vertices.length > 3) {
                    selectedPolygon.vertices.splice(hoveredVertexIndex, 1);
                } else {
                    // Remove the polygon if it has 3 or fewer vertices
                    let index = barriers.indexOf(selectedPolygon as Barrier);
                    if (index > -1) {
                        barriers.splice(index, 1);
                    } else {
                        index = goals.indexOf(selectedPolygon as Goal);
                        if (index > -1) {
                            goals.splice(index, 1);
                        } else {
                            index = effectorCages.indexOf(selectedPolygon);
                            if (index > -1) {
                                effectorCages.splice(index, 1);
                            }
                        }
                    }
                    selectedPolygon = null;
                }
            } else if (hoveredPolygon) {
                selectedPolygon = hoveredPolygon;
            } else {
                selectedPolygon = null;
            }
        }
    }

    isDraggingVertex = false;
    draggedVertexIndex = null;
    mouseDownPos = null;
});

canvas.addEventListener('mousemove', (e) => {
    mousePosition = getMousePos(e);

    if (isMouseDown && mouseDownPos) {
        const dx = mousePosition.x - mouseDownPos.x;
        const dy = mousePosition.y - mouseDownPos.y;
        draggedDistance = Math.sqrt(dx * dx + dy * dy);
    }

    if (isEditMode && isDraggingVertex && selectedPolygon && draggedVertexIndex !== null) {
        selectedPolygon.vertices[draggedVertexIndex] = mousePosition;
    }
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
loadLevels();
