const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Game configuration
const CANVAS_SIZE = 800;
const PADDLE_WIDTH = 100;
const PADDLE_HEIGHT = 15;
const BALL_SIZE = 10;
const BALL_SPEED = 5;
const PADDLE_SPEED = 6;

// Game objects
const ball = { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2, dx: BALL_SPEED, dy: BALL_SPEED };
const leftPaddle = { x: 10, y: CANVAS_SIZE / 2 - PADDLE_HEIGHT / 2, height: PADDLE_HEIGHT };
const rightPaddle = { x: CANVAS_SIZE - 10 - PADDLE_WIDTH, y: CANVAS_SIZE / 2 - PADDLE_HEIGHT / 2, height: PADDLE_HEIGHT };

// Input handling
const keys = {};

document.addEventListener('keydown', (e) => { keys[e.code] = true; });
document.addEventListener('keyup', (e) => { keys[e.code] = false; });

// Get input state
function getMouseY() {
    const rect = canvas.getBoundingClientRect();
    const y = Math.max(0, Math.min(CANVAS_SIZE - 1, e.clientY - rect.top));
    return y;
}

// Update game state
function update() {
    let y = CANVAS_SIZE / 2;
    if (keys['ArrowUp'] || keys['KeyW']) y -= PADDLE_SPEED;
    if (keys['ArrowDown'] || keys['KeyS']) y += PADDLE_SPEED;

    leftPaddle.y = y;
    if (leftPaddle.y < 0) leftPaddle.y = 0;
    if (leftPaddle.y + leftPaddle.height > CANVAS_SIZE) leftPaddle.y = CANVAS_SIZE - leftPaddle.height;

    // Move ball
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Bounce off top and bottom walls
    if (ball.y <= 0 || ball.y + BALL_SIZE >= CANVAS_SIZE) {
        ball.dy *= -1;
    }

    // Check paddle collisions
    if (ball.x + BALL_SIZE <= leftPaddle.x + leftPaddle.width) {
        ball.dx *= -1;
        ball.dy *= -1;
    }
    if (ball.x >= CANVAS_SIZE - leftPaddle.width - BALL_SIZE) {
        ball.dx *= -1;
        ball.dy *= -1;
    }

    // Check if ball goes out of bounds (player loses)
    if (ball.x < 0) {
        alert('You Lost!');
        ball.x = CANVAS_SIZE / 2;
        ball.y = CANVAS_SIZE / 2;
        ball.dx = BALL_SPEED;
        ball.dy = BALL_SPEED;
    }

    // Draw game
    draw();
}

// Draw game
function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw left paddle
    ctx.fillStyle = '#fff';
    ctx.fillRect(10, leftPaddle.y, PADDLE_WIDTH, leftPaddle.height);

    // Draw right paddle
    ctx.fillStyle = '#fff';
    ctx.fillRect(CANVAS_SIZE - 10 - PADDLE_WIDTH, rightPaddle.y, PADDLE_WIDTH, rightPaddle.height);

    // Draw ball
    ctx.fillStyle = '#f00';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_SIZE, 0, Math.PI * 2);
    ctx.fill();

    // Draw score
    ctx.fillStyle = '#fff';
    ctx.font = '20px "Courier New"';
    ctx.fillText('Score: ' + score, 20, 30);
}

// Main game loop
function gameLoop() {
    update();
    requestAnimationFrame(gameLoop);
}

// Start the game
gameLoop();