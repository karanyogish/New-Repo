const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 1024;
canvas.height = 768;

const width = canvas.width;
const height = canvas.height;

// --- GAME CONSTANTS ---
const fps = 60;
const step = 1 / fps;
const drawDistance = 300;
const cameraDepth = 1 / Math.tan((100 * Math.PI) / 180 / 2); 
const segmentLength = 200;
const roadWidth = 2000;
const cameraHeight = 1000;
const lanes = 3;

// Physics Limits
const maxSpeed = segmentLength / step; 
const accel = maxSpeed / 5;
const breaking = -maxSpeed;
const decel = -maxSpeed / 5;
const offRoadDecel = -maxSpeed / 2;
const offRoadLimit = maxSpeed / 4;
const centrifugal = 0.3;

// --- REALISTIC COLORS ---
const COLORS = {
  LIGHT:  { road: '#555555', grass: '#1e5920', rumble: '#dcdcdc', lane: '#ffffff'  },
  DARK:   { road: '#505050', grass: '#194f1a', rumble: '#ff2222', lane: null  }, 
  START:  { road: '#FFFFFF', grass: '#FFFFFF', rumble: '#FFFFFF', lane: '#FFFFFF'  },
  FINISH: { road: '#000000', grass: '#000000', rumble: '#000000', lane: '#000000'  },
  CHECK:  { road: '#00bbff', grass: '#194f1a', rumble: '#ffffff', lane: '#00bbff' } 
};

// --- GAME STATE ---
let segments = [];
let trackLength = 0;
let position = 0;
let speed = 0;
let playerX = 0;
let renderList = [];

// New Modes: Fuel & Checkpoints & Rival
let fuel = 100.0;
let gameOver = false;
let raceStarted = false;
let traffic = [];
let opponent = { z: 0, offset: 0.5, speed: 0 };
let startTime = Date.now();
const checkpointIndices = [1000, 2000];
let passedCheckpoints = [];

// Setup Track and Content
function resetRoad() {
    segments = [];
    const numSegments = 3000; 
    for (let n = 0; n < numSegments; n++) {
        let color = Math.floor(n / 3) % 2 ? COLORS.DARK : COLORS.LIGHT;
        let isCheckpoint = false;
        
        // Start, Finish, and Checkpoints
        if (n < 20) color = COLORS.START;
        else if (n > numSegments - 50) color = COLORS.FINISH;
        else if (checkpointIndices.includes(n)) {
            color = COLORS.CHECK;
            isCheckpoint = true;
        }
        
        segments.push({
            index: n,
            p1: { world: { z: n * segmentLength }, camera: {}, screen: {} },
            p2: { world: { z: (n + 1) * segmentLength }, camera: {}, screen: {} },
            curve: 0,
            color: color,
            sprites: [], 
            scenery: [],
            isCheckpoint: isCheckpoint
        });

        if (n > 50 && n % Math.floor(Math.random() * 15 + 5) === 0) {
            let side = Math.random() > 0.5 ? 1 : -1;
            segments[n].scenery.push({
                offset: side * (1.3 + Math.random()), 
                type: 'tree'
            });
        }
    }

    const addCurve = (start, end, force) => {
        for (let i = start; i < end; i++) {
            if (segments[i]) segments[i].curve = force;
        }
    };

    addCurve(50, 150, 0.4);            
    addCurve(200, 300, -0.6);          
    addCurve(450, 550, 0.8);           
    addCurve(700, 800, -0.7);          
    for(let i=1000; i<1500; i++) segments[i].curve = Math.sin((i - 1000) / 40) * 0.8;
    addCurve(1800, 2000, 1.2); 
    addCurve(2200, 2400, -1.2);

    trackLength = segments.length * segmentLength;
    
    opponent = {
        z: cameraHeight + 500, 
        offset: 0.5,
        speed: maxSpeed * 0.73 
    };
    
    // Spaced Out Traffic (Doesn't spawn near start)
    traffic = [];
    const trafficCount = 20;
    // Leave a massive 60,000 unit buffer at the start so the player is safe initially!
    const trafficGap = (trackLength - 60000) / trafficCount;
    for (let i = 0; i < trafficCount; i++) {
        traffic.push({
            z: 60000 + (i * trafficGap),
            offset: (Math.random() * 1.6) - 0.8,
            speed: -(maxSpeed / 5) // Milder opposite speed to give reaction time
        });
    }
}

resetRoad();

function findSegment(z) {
    return segments[Math.floor(z / segmentLength) % segments.length];
}

// --- RENDERING MATH ---
function project(p, cameraX, cameraY, cameraZ, cameraDepth, width, height, roadWidth) {
    p.camera.x = (p.world.x || 0) - cameraX;
    p.camera.y = (p.world.y || 0) - cameraY;
    p.camera.z = (p.world.z || 0) - cameraZ;
    if (p.camera.z === 0) p.camera.z = 1;
    
    p.screen.scale = cameraDepth / p.camera.z;
    p.screen.x = Math.round((width / 2) + (p.screen.scale * p.camera.x * width / 2));
    p.screen.y = Math.round((height / 2) - (p.screen.scale * p.camera.y * height / 2));
    p.screen.w = Math.round((p.screen.scale * roadWidth * width / 2));
}

// --- DRAWING HELPER FUNCTIONS ---
function drawPolygon(ctx, x1, y1, x2, y2, x3, y3, x4, y4, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4);
    ctx.closePath(); ctx.fill();
}

function drawSegment(ctx, width, lanes, x1, y1, w1, x2, y2, w2, color) {
    const r1 = w1 / Math.max(6, 2 * lanes), r2 = w2 / Math.max(6, 2 * lanes);
    const l1 = w1 / Math.max(32, 8 * lanes), l2 = w2 / Math.max(32, 8 * lanes);

    ctx.fillStyle = color.grass;
    ctx.fillRect(0, y2, width, y1 - y2);

    drawPolygon(ctx, x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2, color.rumble);
    drawPolygon(ctx, x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2, color.rumble);
    drawPolygon(ctx, x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, color.road);

    if (color.lane) {
        let lanew1 = w1 * 2 / lanes, lanew2 = w2 * 2 / lanes;
        let lanex1 = x1 - w1 + lanew1, lanex2 = x2 - w2 + lanew2;
        for (let lane = 1; lane < lanes; lanex1 += lanew1, lanex2 += lanew2, lane++) {
            drawPolygon(ctx, lanex1 - l1 / 2, y1, lanex1 + l1 / 2, y1, lanex2 + l2 / 2, y2, lanex2 - l2 / 2, y2, color.lane);
        }
    }
}

// --- WORLD ASSETS RENDERING ---
function drawTree(ctx, x, y, scale) {
    if (scale <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    
    let W = 1000 * scale * (width / 2);
    let H = W * 2.5; 
    
    ctx.fillStyle = '#3e2411'; ctx.fillRect(-W/10, -H, W/5, H);
    
    ctx.fillStyle = '#2d6d23'; 
    ctx.beginPath(); ctx.arc(0, -H*0.8, W*0.5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#3a872e'; 
    ctx.beginPath(); ctx.arc(-W*0.1, -H*0.9, W*0.35, 0, Math.PI*2); ctx.fill();

    ctx.restore();
}

function drawOverheadBanner(ctx, x, y, scale, roadWidthScreen) {
    if (scale <= 0) return;
    ctx.save();
    
    let bannerW = roadWidthScreen * 2.2;
    let bannerH = 1000 * scale * (width/2);
    let bannerY = y - (3500 * scale * (width/2)); 
    
    ctx.fillStyle = '#333';
    ctx.fillRect(x - bannerW/2, bannerY, 30 * scale * width/2, 3500 * scale * width/2);
    ctx.fillRect(x + bannerW/2 - (30 * scale * width/2), bannerY, 30 * scale * width/2, 3500 * scale * width/2);

    ctx.fillStyle = '#00bbff';
    ctx.fillRect(x - bannerW/2, bannerY, bannerW, bannerH);
    ctx.fillStyle = '#fff';
    ctx.font = `900 ${Math.max(10, 450 * scale * (width/2))}px Outfit, Arial`;
    ctx.textAlign = 'center';
    ctx.fillText("FUEL CHECKPOINT", x, bannerY + bannerH*0.7);
    
    ctx.restore();
}

// Highly Visible and Larger Traffic Car
function drawTrafficCar(ctx, x, y, scale) {
    if (scale <= 0) return;
    ctx.save(); ctx.translate(x, y);
    
    // Narrower width so it doesn't block the whole road, but kept tall
    let W = 1500 * scale * (width / 2); 
    let H = W * 0.8; 
    
    // Bottom Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath(); ctx.ellipse(0, 0, W/1.8, H*0.1, 0, 0, Math.PI*2); ctx.fill();

    // Main Lower Body
    ctx.fillStyle = '#2a4d69'; 
    ctx.fillRect(-W/2, -H*0.8, W, H*0.8);
    
    // Roof / Cabin
    ctx.fillStyle = '#111'; 
    ctx.fillRect(-W*0.4, -H*1.5, W*0.8, H*0.7);
    
    // Bright Front Headlights
    ctx.fillStyle = '#ffffff'; 
    ctx.fillRect(-W*0.45, -H*0.6, W*0.25, H*0.3); // Left light outer
    ctx.fillRect(W*0.2, -H*0.6, W*0.25, H*0.3);  // Right light outer
    
    ctx.fillStyle = '#ffeeff'; 
    ctx.fillRect(-W*0.4, -H*0.55, W*0.15, H*0.2); // Left bright center
    ctx.fillRect(W*0.25, -H*0.55, W*0.15, H*0.2); // Right bright center
    
    // Bright Windshield Reflection
    ctx.fillStyle = '#66ccff'; 
    ctx.fillRect(-W*0.35, -H*1.4, W*0.7, H*0.5);
    
    // Dark Grill
    ctx.fillStyle = '#0a0a0a'; 
    ctx.fillRect(-W*0.2, -H*0.6, W*0.4, H*0.4);

    // Bumper
    ctx.fillStyle = '#888';
    ctx.fillRect(-W/2, -H*0.2, W, H*0.2);

    ctx.restore();
}

function drawDetailedBike(ctx, x, y, scale, tilt, driverColor, isRival) {
    if (scale <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale); 
    ctx.rotate(tilt * Math.PI / 180);

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(0, 5, 30, 6, 0, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = '#111'; ctx.fillRect(-20, -15, 40, 50); 
    ctx.fillStyle = '#050505'; ctx.fillRect(-15, -15, 30, 50);

    ctx.fillStyle = driverColor === 'player' ? '#b34700' : '#44aa00';
    ctx.beginPath(); ctx.arc(0, 15, 12, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = '#888'; ctx.fillRect(16, 0, 8, 30); ctx.fillRect(-24, 0, 8, 30);
    ctx.fillStyle = '#222'; ctx.fillRect(17, 30, 6, 5); ctx.fillRect(-23, 30, 6, 5);

    if (!isRival && speed > maxSpeed * 0.8) {
        ctx.fillStyle = '#00bbff';
        ctx.beginPath(); ctx.moveTo(20, 35); ctx.lineTo(25, 35 + Math.random()*15); ctx.lineTo(15, 35); ctx.fill();
    }

    let grad = ctx.createLinearGradient(0, -90, 0, 10);
    if (driverColor === 'player') {
        grad.addColorStop(0, '#ff1a1a'); grad.addColorStop(1, '#990000');
    } else {
        grad.addColorStop(0, '#1aff1a'); grad.addColorStop(1, '#009900');
    }
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -90);   
    ctx.lineTo(38, -10);  
    ctx.lineTo(20, 20);   
    ctx.lineTo(-20, 20);  
    ctx.lineTo(-38, -10); 
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(0, -85); ctx.lineTo(15, -20); ctx.lineTo(5, -20); ctx.closePath(); ctx.fill();

    ctx.fillStyle = '#1c1c1c'; ctx.fillRect(-12, -65, 24, 30);

    ctx.fillStyle = '#ff0000'; ctx.fillRect(-8, -90, 16, 4);
    
    if (isRival) {
        ctx.fillStyle = '#11ff11';
        ctx.font = '900 16px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("RIVAL", 0, -150);
    }

    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath(); ctx.ellipse(-18, -35, 12, 28, Math.PI/6, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(18, -35, 12, 28, -Math.PI/6, 0, Math.PI*2); ctx.fill();
    
    ctx.fillStyle = driverColor === 'player' ? '#e6e6e6' : '#111111'; 
    ctx.beginPath(); ctx.ellipse(0, -80, 24, 45, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = driverColor === 'player' ? '#ff0000' : '#00ff00'; ctx.fillRect(-8, -105, 16, 40);

    ctx.fillStyle = driverColor === 'player' ? '#111' : '#ffffff';
    ctx.beginPath(); ctx.arc(0, -135, 20, 0, Math.PI*2); ctx.fill();
    
    ctx.fillStyle = '#00ddff';
    ctx.beginPath(); ctx.arc(0, -135, 20, Math.PI + 0.3, Math.PI*2 - 0.3); ctx.fill();
    
    ctx.restore();
}

// --- INPUTS ---
const keys = {ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false};
window.addEventListener('keydown', e => { if (keys.hasOwnProperty(e.key)) keys[e.key] = true; });
window.addEventListener('keyup', e => { if (keys.hasOwnProperty(e.key)) keys[e.key] = false; });

// --- GAME LOGIC ---
function update(dt) {
    if (gameOver) return;

    if (!raceStarted && speed > 0) raceStarted = true;

    // Fuel depletion
    if (raceStarted) {
        fuel -= dt * 3.5; 
        if (fuel <= 0) {
            fuel = 0;
            triggerGameOver("OUT OF FUEL! YOU LOSE.");
        }
    }

    let baseSegment = findSegment(position);
    
    // Checkpoint
    if (baseSegment.isCheckpoint && !passedCheckpoints.includes(baseSegment.index)) {
        passedCheckpoints.push(baseSegment.index);
        fuel = 100.0;
        document.querySelector('.game-container').classList.add('fuel-flash');
        setTimeout(()=> document.querySelector('.game-container').classList.remove('fuel-flash'), 300);
    }

    let speedPercent = speed / maxSpeed;
    let dx = dt * 2 * speedPercent; 
    
    position += dt * speed;
    
    playerX = playerX - (dx * speedPercent * baseSegment.curve * centrifugal);
    if (keys.ArrowLeft) playerX -= dx;
    else if (keys.ArrowRight) playerX += dx;
    playerX = Math.max(-2.5, Math.min(2.5, playerX));
    
    if (keys.ArrowUp) speed += accel * dt;
    else if (keys.ArrowDown) speed += breaking * dt;
    else speed += decel * dt;
    
    if ((playerX < -1 || playerX > 1) && speed > offRoadLimit) speed += offRoadDecel * dt;
    speed = Math.max(0, Math.min(maxSpeed, speed));
    
    // Opponent AI
    if (raceStarted) {
        opponent.z += opponent.speed * dt;
        let rivalSeg = findSegment(opponent.z + cameraHeight);
        let targetOffset = 0; 
        
        for(let look = 0; look < 20; look++) {
            let checkSeg = segments[(rivalSeg.index + look) % segments.length];
            for (let s of checkSeg.sprites) {
                if (s.type === 'traffic' && Math.abs(s.offset - opponent.offset) < 0.8) {
                    targetOffset = opponent.offset > 0 ? -1.0 : 1.0; 
                }
            }
        }
        opponent.offset += (targetOffset - opponent.offset) * 0.05; 
    }

    // Traffic Update
    for(let i=0; i<traffic.length; i++) {
        let t = traffic[i];
        t.z += t.speed * dt;
        if (t.z < 0) t.z += trackLength; 
    }

    // Object Attachment
    for(let i=0; i<segments.length; i++) segments[i].sprites = [];
    for(let i=0; i<traffic.length; i++) {
        findSegment(traffic[i].z).sprites.push({ offset: traffic[i].offset, type: 'traffic' });
    }
    findSegment(opponent.z).sprites.push({ offset: opponent.offset, type: 'rival' });

    let pSeg = findSegment(position + cameraHeight);
    for(let s=0; s<pSeg.sprites.length; s++) {
        let sprite = pSeg.sprites[s];
        // Reduced collision hitbox so player has room to squeeze by
        if (sprite.type === 'traffic' && Math.abs(playerX - sprite.offset) < 0.5) {
            speed = 0; 
            document.querySelector('.game-container').classList.add('crash-flash');
            triggerGameOver("FATAL CRASH! YOU HIT A DRIVER.");
        }
    }

    // Final Destination Logic
    if (position >= trackLength - 3000 && !gameOver) {
        speed *= 0.9; 
        if (position > opponent.z) triggerGameOver("1ST PLACE! YOU DEFEATED THE RIVAL!");
        else triggerGameOver("2ND PLACE! RIVAL REACHED DESTINATION FIRST.");
    }
    
    document.getElementById('speedVal').innerText = Math.round(speed / 100);
    document.getElementById('fuelVal').innerText = Math.max(0, Math.round(fuel));
}

function triggerGameOver(msg) {
    gameOver = true;
    speed = 0;
    document.getElementById('gameOverPanel').classList.remove('hidden');
    document.getElementById('goTitle').innerText = msg;
}

// --- RENDER ROUTINE ---
function render() {
    ctx.clearRect(0, 0, width, height);

    let cycle = ((Date.now() - startTime) / 40000) % 1; 
    let r, g, b;
    if (cycle < 0.25) { r = 114; g = 215; b = 238; } 
    else if (cycle < 0.5) { let p = (cycle - 0.25) / 0.25; r = 114 + p*(255-114); g = 215 + p*(120-215); b = 238 + p*(50-238); } 
    else if (cycle < 0.75) { let p = (cycle - 0.5) / 0.25; r = 255 + p*(10-255); g = 120 + p*(15-120); b = 50 + p*(30-50); } 
    else { let p = (cycle - 0.75) / 0.25; if (p < 0.5) { let p2 = p*2; r = 10 + p2*(200-10); g = 15 + p2*(100-15); b = 30 + p2*(100-30); } else { let p2 = (p-0.5)*2; r = 200 + p2*(114-200); g = 100 + p2*(215-100); b = 100 + p2*(238-100); } }
    
    ctx.fillStyle = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`; 
    ctx.fillRect(0, 0, width, height);
    
    let sunY = height/2 - 50 + Math.sin(cycle * Math.PI * 2) * 200;
    if (sunY < height/2 + 100) {
        ctx.fillStyle = `rgba(255, 221, 0, ${Math.max(0, 1 - (sunY / (height/2)))})`;
        ctx.beginPath(); ctx.arc(width/2, sunY, 70, 0, Math.PI*2); ctx.fill();
    }

    let baseSegment = findSegment(position);
    let basePercent = (position % segmentLength) / segmentLength;

    let x = 0, dx = -(baseSegment.curve * basePercent);
    renderList = [];

    for (let n = 0; n < drawDistance; n++) {
        let segment = segments[(baseSegment.index + n) % segments.length];
        segment.looped = segment.index < baseSegment.index;

        segment.p1.world.x = x; segment.p1.world.y = 0;
        x += dx; dx += segment.curve;
        segment.p2.world.x = x; segment.p2.world.y = 0;

        let zOffset = segment.looped ? trackLength : 0;
        project(segment.p1, (playerX * roadWidth) - segment.p1.world.x, cameraHeight, position - zOffset, cameraDepth, width, height, roadWidth);
        project(segment.p2, (playerX * roadWidth) - segment.p2.world.x, cameraHeight, position - zOffset, cameraDepth, width, height, roadWidth);

        if (segment.p1.camera.z <= cameraDepth || segment.p2.screen.y >= segment.p1.screen.y) continue;
        renderList.unshift(segment); 
    }

    const mtnOffset = -(playerX * 100) - (x * 0.04); 
    ctx.fillStyle = '#2b5a2b';
    ctx.beginPath(); ctx.moveTo(0, height/2);
    for (let i = -1; i < 6; i++) ctx.lineTo(width/2 + mtnOffset + i*300, height/2 - 50 - Math.abs(Math.sin(i*2)*120));
    ctx.lineTo(width, height/2); ctx.fill();

    ctx.fillStyle = COLORS.DARK.grass; ctx.fillRect(0, height/2, width, height/2);

    // Draw Back to Front
    for (let n = 0; n < renderList.length; n++) {
        let seg = renderList[n];
        drawSegment(ctx, width, lanes, seg.p1.screen.x, seg.p1.screen.y, seg.p1.screen.w, seg.p2.screen.x, seg.p2.screen.y, seg.p2.screen.w, seg.color);
        
        if (seg.isCheckpoint && n === renderList.length - Math.floor(drawDistance / 2)) {
            drawOverheadBanner(ctx, seg.p1.screen.x, seg.p1.screen.y, seg.p1.screen.scale, seg.p1.screen.w);
        }

        for(let s=0; s<seg.scenery.length; s++) {
            let sc = seg.scenery[s];
            let scX = seg.p1.screen.x + (seg.p1.screen.w * sc.offset);
            if (sc.type === 'tree') drawTree(ctx, scX, seg.p1.screen.y, seg.p1.screen.scale);
        }

        for(let s=0; s<seg.sprites.length; s++) {
            let sprite = seg.sprites[s];
            let spriteX = seg.p1.screen.x + (seg.p1.screen.w * sprite.offset); 
            
            if (sprite.type === 'traffic') {
                drawTrafficCar(ctx, spriteX, seg.p1.screen.y, seg.p1.screen.scale);
            } else if (sprite.type === 'rival') {
                drawDetailedBike(ctx, spriteX, seg.p1.screen.y, seg.p1.screen.scale * 1200, seg.curve * 30, 'rival', true);
            }
        }
    }

    let bikeTilt = (baseSegment.curve * (speed/maxSpeed) * 30); 
    if (keys.ArrowLeft) bikeTilt -= 10;
    if (keys.ArrowRight) bikeTilt += 10;
    
    let bounce = (1.5 * Math.random() * (speed/maxSpeed) * (height / 480)) * (Math.random() > 0.5 ? 1 : -1);
    
    drawDetailedBike(ctx, width/2, height - Math.max(100, Math.min(150, 100 + (speed/maxSpeed)*20)) + bounce, 1.4, bikeTilt, 'player', false);
}

let lastTime = Date.now();
function gameLoop() {
    let now = Date.now();
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    if (dt > 0.1) dt = 0.1;

    update(dt);
    render();
    
    requestAnimationFrame(gameLoop);
}

gameLoop();
