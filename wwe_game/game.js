const canvas = document.getElementById('fightCanvas');
const ctx = canvas.getContext('2d');

const width = canvas.width;
const height = canvas.height;

// Best of 3 Game State
let gameOver = false;
let currentRound = 1;
let p1Wins = 0;
let p2Wins = 0;
let roundOver = false;
let roundDelayTimer = 0;
let roundIntroTimer = 120; // 2 seconds UI buffer before round begins

let gameStartTime = Date.now();

// Inputs
const keys = { a: false, d: false, w: false, j: false, k: false, l: false };
window.addEventListener('keydown', e => {
    let k = e.key.toLowerCase();
    if (keys.hasOwnProperty(k)) keys[k] = true;
});
window.addEventListener('keyup', e => {
    let k = e.key.toLowerCase();
    if (keys.hasOwnProperty(k)) keys[k] = false;
});

// Environment Drawing Tools
function drawBackgroundRing(ctx) {
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 30; i++) {
        if (Math.random() > 0.9) {
            ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#88aaff';
            ctx.beginPath();
            ctx.arc(Math.random()*width, Math.random()*(height - 250), Math.random()*3 + 1, 0, Math.PI*2);
            ctx.fill();
        }
    }

    ctx.fillStyle = '#444';
    ctx.fillRect(80, 150, 20, 300);
    ctx.fillRect(width - 100, 150, 20, 300);

    ctx.strokeStyle = '#c00'; 
    ctx.lineWidth = 6;
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(90, 200 + (i * 60));
        ctx.lineTo(width - 90, 200 + (i * 60));
        ctx.stroke();
    }

    let rad = ctx.createRadialGradient(width/2, height-100, 50, width/2, height-50, width);
    rad.addColorStop(0, '#5ea8e5');
    rad.addColorStop(1, '#1b3b5a');
    ctx.fillStyle = rad;
    
    ctx.beginPath();
    ctx.moveTo(30, 400); 
    ctx.lineTo(width - 30, 400);
    ctx.lineTo(width + 200, height);
    ctx.lineTo(-200, height);
    ctx.fill();
}

function drawForegroundRing(ctx) {
    ctx.fillStyle = '#222';
    ctx.fillRect(-20, 100, 50, 400);
    ctx.fillRect(width - 30, 100, 50, 400);

    ctx.strokeStyle = '#dd0000';
    ctx.lineWidth = 12;
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 300 + (i * 100));
        ctx.lineTo(width, 300 + (i * 100));
        ctx.stroke();
    }
}

// Referee Logic!
let refX = 512;
let refY = 400; // Stand in the background

function drawReferee(ctx, x, y, facing, state) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);
    
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 5, 30, 8, 0, 0, Math.PI*2); ctx.fill();

    let arm2R = state === 'starting' ? -Math.PI/1.2 : (state === 'ko' ? -Math.PI/1.5 : 0.5); 
    ctx.save(); ctx.translate(5, -115); ctx.rotate(arm2R);
    ctx.fillStyle = '#ffdbac'; 
    ctx.beginPath(); ctx.roundRect(-5, 0, 10, 45, 5); ctx.fill();
    ctx.restore();

    let l1R = 0.1, l2R = -0.1;
    if (state === 'moving') {
        let cycle = Math.sin(Date.now() / 150);
        l1R = cycle * 0.4; l2R = -cycle * 0.4;
    }

    ctx.save(); ctx.translate(5, -50); ctx.rotate(l2R);
    ctx.fillStyle = '#111'; 
    ctx.beginPath(); ctx.roundRect(-6, 0, 12, 50, 6); ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.roundRect(-15, -115, 30, 70, 5); ctx.fill();
    ctx.fillStyle = '#111';
    for(let i=0; i<3; i++) ctx.fillRect(-15 + (i*10) + 2, -115, 6, 70); 
    
    ctx.save(); ctx.translate(-5, -50); ctx.rotate(l1R);
    ctx.fillStyle = '#111'; 
    ctx.beginPath(); ctx.roundRect(-6, 0, 12, 50, 6); ctx.fill();
    ctx.restore();

    let arm1R = state === 'starting' ? -Math.PI/1.3 : (state === 'ko' ? -Math.PI/1.6 : 0.3); 
    ctx.save(); ctx.translate(-10, -115); ctx.rotate(arm1R);
    ctx.fillStyle = '#ffdbac'; 
    ctx.beginPath(); ctx.roundRect(-5, 0, 10, 45, 5); ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#ffdbac';
    ctx.beginPath(); ctx.arc(0, -130, 16, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#000'; 
    ctx.beginPath(); ctx.arc(6, -132, 2, 0, Math.PI*2); ctx.fill(); 

    ctx.restore();
}

// Points Feedback Effect
let floatingTexts = [];
function addFloatingText(text, x, y, color) {
    floatingTexts.push({text, x, y, life: 60, color});
}

// Complex Kinematic Drawing for Human Wrestler
function drawWrestler(ctx, wrestler) {
    ctx.save();
    ctx.translate(wrestler.x, wrestler.y);
    ctx.scale(wrestler.facing, 1);
    
    let leg1R = 0, leg2R = 0;
    let arm1R = 0, arm2R = 0;
    let headX = 0, headY = -140;
    let chestR = 0;

    let s = wrestler.state;
    if (s === 'walk') {
        let cycle = Math.sin(Date.now() / 100);
        leg1R = cycle * 0.6; leg2R = -cycle * 0.6;
        arm1R = -cycle * 0.5; arm2R = cycle * 0.5;
    } else if (s === 'punch') {
        arm1R = -Math.PI/1.5; arm2R = Math.PI/4; 
        chestR = 0.2;
    } else if (s === 'kick') {
        leg1R = -Math.PI/2.2; leg2R = 0.1;
        arm1R = Math.PI/4; arm2R = Math.PI/4;
        chestR = -0.2;
    } else if (s === 'block') {
        arm1R = Math.PI/1.2; arm2R = Math.PI/1.3;
        headX = -10; leg1R = 0.2; leg2R = -0.1;
    } else if (s === 'hit') {
        headX = -20; headY = -120;
        arm1R = -0.5; arm2R = -0.7;
        leg1R = 0.3; leg2R = 0.3; chestR = -0.4;
    } else if (s === 'jump') {
        leg1R = 0.5; leg2R = -0.5;
        arm1R = -2; arm2R = -1;
    } else if (s === 'dead') {
        ctx.rotate(-Math.PI / 2);
        ctx.translate(-50, 50); 
        arm1R = -0.5; arm2R = -0.5;
        leg1R = 0.1; leg2R = 0.2;
    } else { 
        let bounce = Math.sin(Date.now() / 300) * 0.1;
        leg1R = 0.1; leg2R = -0.1;
        arm1R = 0.3 + bounce; arm2R = 0.5 + bounce;
    }

    if (s !== 'dead' && s !== 'jump') {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath(); ctx.ellipse(0, 5, 45, 12, 0, 0, Math.PI*2); ctx.fill();
    }

    ctx.rotate(chestR);

    const drawLimb = (oX, oY, rotation, len, isLeg) => {
        ctx.save(); ctx.translate(oX, oY); ctx.rotate(rotation);
        ctx.fillStyle = wrestler.colors.skin;
        ctx.beginPath(); ctx.roundRect(-8, 0, 16, len, 8); ctx.fill();
        if (isLeg) { 
            ctx.fillStyle = '#111';
            ctx.fillRect(-10, len-20, 20, 25);
            ctx.fillRect(0, len-5, 12, 10); 
        } else { 
            ctx.fillStyle = wrestler.colors.gloves;
            ctx.beginPath(); ctx.arc(0, len, 14, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
    }

    drawLimb(5, -115, arm2R, 50, false);
    drawLimb(8, -50, leg2R, 60, true);

    ctx.fillStyle = wrestler.colors.skin;
    ctx.beginPath(); ctx.roundRect(-22, -120, 44, 75, 10); ctx.fill();
    
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-15, -90); ctx.lineTo(15, -90); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -90); ctx.lineTo(0, -60); ctx.stroke();

    ctx.fillStyle = wrestler.colors.shorts;
    ctx.beginPath(); ctx.roundRect(-24, -55, 48, 30, 6); ctx.fill();
    ctx.fillStyle = '#333'; ctx.fillRect(-24, -60, 48, 10);

    drawLimb(-8, -50, leg1R, 60, true);
    drawLimb(-15, -115, arm1R, 50, false);

    ctx.fillStyle = wrestler.colors.skin;
    ctx.beginPath(); ctx.arc(headX, headY, 20, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(headX + 10, headY - 5, 3, 0, Math.PI*2); ctx.fill(); 
    ctx.fillRect(headX + 5, headY + 5, 10, 2); 

    ctx.restore();
}

class Fighter {
    constructor(x, y, isOpponent) {
        this.baseY = y;
        this.startX = x;
        this.x = x;
        this.y = y;
        this.isOpponent = isOpponent;
        this.health = 100;
        this.state = 'idle'; 
        this.timer = 0;
        this.facing = isOpponent ? -1 : 1;
        this.points = 0;
        this.velocityY = 0;
        this.isJumping = false;
        
        this.colors = isOpponent ? 
            { skin: '#8d5524', shorts: '#222', gloves: '#ffcc00' } : 
            { skin: '#ffdbac', shorts: '#ff1111', gloves: '#1111ff' };
    }

    takeDamage(amt) {
        if (this.state === 'dead' || roundOver || roundIntroTimer > 0) return;
        this.health = Math.max(0, this.health - amt);
        this.state = 'hit';
        this.timer = 15;
        if (this.health === 0) {
            this.state = 'dead';
            this.timer = 999;
        }
    }

    update(enemy) {
        if (this.state === 'dead') {
            if (this.y < this.baseY) this.y += 5; 
            return;
        }

        if (this.timer > 0) this.timer--;
        if (this.timer <= 0 && !this.isJumping) this.state = 'idle';

        if (this.isJumping) {
            this.y += this.velocityY;
            this.velocityY += 1.5; 
            if (this.y >= this.baseY) {
                this.y = this.baseY;
                this.isJumping = false;
                if (this.timer <= 0) this.state = 'idle';
            }
        }

        if (!roundOver && roundIntroTimer <= 0) {
            if (!this.isOpponent) this.playerLogic();
            else this.aiLogic(enemy);
        }

        this.x = Math.max(100, Math.min(width - 100, this.x));
        
        if (enemy.state !== 'dead') {
            this.facing = (enemy.x > this.x) ? 1 : -1;
        }

        if (!roundOver && this.state === 'punch' && this.timer === 15) { 
            let reach = this.x + (60 * this.facing);
            if (Math.abs(reach - enemy.x) < 50 && enemy.state !== 'hit') {
                if (enemy.state === 'block') { enemy.takeDamage(2); } 
                else { 
                    enemy.takeDamage(10); 
                    this.points += 5; 
                    addFloatingText("+5 PTS", enemy.x, enemy.y - 160, this.colors.gloves);
                }
            }
        }

        if (!roundOver && this.state === 'kick' && this.timer === 15) { 
            let reach = this.x + (80 * this.facing);
            if (Math.abs(reach - enemy.x) < 55 && enemy.state !== 'hit') {
                if (enemy.state === 'block') { enemy.takeDamage(4); } 
                else { 
                    enemy.takeDamage(15); 
                    this.points += 10; 
                    addFloatingText("+10 PTS", enemy.x, enemy.y - 160, this.colors.gloves); 
                }
            }
        }
    }

    playerLogic() {
        if (this.state === 'hit' || this.state === 'dead') return;
        
        let moving = false;
        if (keys['a']) { this.x -= 4.5; moving = true; }
        if (keys['d']) { this.x += 4.5; moving = true; }
        
        if (keys['w'] && !this.isJumping && this.state === 'idle') {
            this.isJumping = true;
            this.velocityY = -18;
            this.state = 'jump';
        }

        if (this.state === 'idle' || this.state === 'walk') {
            if (moving && !this.isJumping) this.state = 'walk';
            
            if (keys['j']) { this.state = 'punch'; this.timer = 20; }
            else if (keys['k']) { this.state = 'kick'; this.timer = 25; }
            else if (keys['l']) { this.state = 'block'; this.timer = 5; } 
        }
    }

    aiLogic(enemy) {
        if (this.state === 'hit' || this.state === 'dead' || this.isJumping) return;
        if (this.timer > 0) return; 

        let dist = Math.abs(enemy.x - this.x);
        
        if (dist > 70) {
            this.state = 'walk';
            this.x += (enemy.x > this.x ? 5 : -5); 
            
            if (Math.random() < 0.015) {
                this.isJumping = true;
                this.velocityY = -18;
                this.state = 'jump';
            }
        } else {
            let r = Math.random();
            if ((enemy.state === 'punch' || enemy.state === 'kick') && enemy.timer > 5) {
                if (r < 0.6) { this.state = 'block'; this.timer = 15; return; }
                else if (r < 0.9) { this.state = 'punch'; this.timer = 12; return; } 
            }

            if (r < 0.15) { this.state = 'punch'; this.timer = 12; } 
            else if (r < 0.25) { this.state = 'kick'; this.timer = 20; }
            else if (r < 0.35) { this.state = 'block'; this.timer = 15; }
            else { this.state = 'idle'; }
        }
    }
}

let p1 = new Fighter(250, 450, false);
let p2 = new Fighter(750, 450, true);

// Main Update Loop
function gameLoop() {
    drawBackgroundRing(ctx);
    
    // Process round intro rules
    let refState = 'idle';
    let splash = document.getElementById('roundSplash');

    if (roundIntroTimer > 0) {
        roundIntroTimer--;
        refState = 'starting';
        
        splash.style.display = 'block';
        if (roundIntroTimer > 60) {
            splash.innerText = "ROUND " + currentRound;
            splash.style.color = '#ffcc00';
        } else if (roundIntroTimer === 60) {
            splash.innerText = "FIGHT!";
            splash.style.color = '#fff';
        }
    } else {
        if (!roundOver) {
            splash.style.display = 'none';
            p1.update(p2);
            p2.update(p1);
            
            // Ref watches the action by moving back and forth
            let targetX = (p1.x + p2.x) / 2;
            if (Math.abs(refX - targetX) > 10) {
                refX += (targetX - refX) * 0.05;
                refState = 'moving';
            }
        }
    }

    // Handle Knockout Tracking & Round Ending
    if ((p1.health === 0 || p2.health === 0) && !roundOver && roundIntroTimer <= 0) {
        roundOver = true;
        roundDelayTimer = 180; // 3 seconds at 60fps
        splash.innerText = "K.O!";
        splash.style.color = '#ff0000';
        splash.style.display = 'block';
        
        if (p1.health === 0) p2Wins++;
        else { p1Wins++; p1.points += 15; addFloatingText("+15 MATCH PTS!", p1.x, p1.y - 200, '#00ff00'); } 
    }

    if (roundOver) {
        refState = 'ko'; // ref points to the downed fighter
        p1.update(p2); p2.update(p1); // gravity only

        roundDelayTimer--;
        if (roundDelayTimer <= 0) {
            splash.style.display = 'none';

            if (p1Wins >= 2 || p2Wins >= 2) {
                if (!gameOver) {
                    gameOver = true;
                    let overlay = document.getElementById('gameOverPanel');
                    let sub = document.getElementById('goSubtitle');
                    overlay.classList.remove('hidden');
                    if (p1Wins >= 2) sub.innerText = "AND NEW HEAVYWEIGHT CHAMPION OF THE WORLD... YOU!";
                    else sub.innerText = "CHAMPION RETAINS! YOU LOST THE BEST OF 3.";
                }
            } else {
                currentRound++;
                roundIntroTimer = 120; // reset buffer!
                p1.health = 100; p2.health = 100;
                p1.state = 'idle'; p2.state = 'idle';
                p1.x = p1.startX; p2.x = p2.startX;
                roundOver = false;
            }
        }
    }

    // Draw Entities
    drawReferee(ctx, refX, refY, p1.x > p2.x ? -1 : 1, refState);
    drawWrestler(ctx, p2);
    drawWrestler(ctx, p1);

    // Process & Draw Floating Combat Point Texts
    for(let i = floatingTexts.length-1; i>=0; i--) {
        let ft = floatingTexts[i];
        ft.y -= 1.5;
        ft.life--;
        ctx.globalAlpha = ft.life / 60;
        ctx.fillStyle = ft.color || '#ffcc00';
        ctx.font = 'bold 36px Oswald, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.globalAlpha = 1.0;
        if (ft.life <= 0) floatingTexts.splice(i, 1);
    }

    drawForegroundRing(ctx);

    // DOM Updates
    document.getElementById('p1-health').style.width = p1.health + '%';
    document.getElementById('p2-health').style.width = p2.health + '%';
    document.getElementById('p1-points').innerText = p1.points + " PTS";
    document.getElementById('p2-points').innerText = p2.points + " PTS";
    document.getElementById('p1-wins').innerText = p1Wins + " WINS";
    document.getElementById('p2-wins').innerText = p2Wins + " WINS";
    document.getElementById('roundNum').innerText = currentRound;

    if (!gameOver) requestAnimationFrame(gameLoop);
}

gameLoop();
