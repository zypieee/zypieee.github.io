// Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

// UI Elements
const scoreDisplay = document.getElementById('scoreDisplay');
const healthDisplay = document.getElementById('healthDisplay');
const weaponDisplay = document.getElementById('weaponDisplay');
const levelDisplay = document.getElementById('levelDisplay');
const expDisplay = document.getElementById('expDisplay');

const menu = document.getElementById('menu');
const startBtn = document.getElementById('startBtn');
const difficultySelect = document.getElementById('difficultySelect');
const settingsBtn = document.getElementById('settingsBtn');
const settingsDiv = document.getElementById('settings');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const volumeSlider = document.getElementById('volumeSlider');
const leaderboardDiv = document.getElementById('leaderboard');

let gameRunning = false;
let score = 0;
let currentLevel = 1;
let deltaTime = 0;
let lastFrameTime = 0;
let slowMotionTimer = 0;
let levelTransition = false;
let levelTransitionTime = 0;
const levelTransitionDuration = 1500;
let spawnInterval = 2000;
let lastSpawnTime = 0;
let lastPowerUpTime = 0;
const levelScoreThreshold = 150;

// Difficulty settings
const difficulties = {
  easy: { enemySpeed: 0.6, enemyDamage: 8, powerUpRate: 1.5, enemyHealthMultiplier: 0.7 },
  normal: { enemySpeed: 1, enemyDamage: 12, powerUpRate: 1, enemyHealthMultiplier: 1 },
  hard: { enemySpeed: 1.4, enemyDamage: 16, powerUpRate: 0.7, enemyHealthMultiplier: 1.3 },
};
let currentDifficulty = difficulties.normal;

// Mouse tracking
let mousePos = { x: WIDTH / 2, y: HEIGHT / 2 };
let mouseDown = false;

// Key tracking
const keys = {};

// Sounds
const bgMusic = new Audio('https://opengameart.org/sites/default/files/Peaceful%20Funk%20Loop.ogg');
bgMusic.loop = true;
bgMusic.volume = 0.3;

const fireSound = new Audio('https://freesound.org/data/previews/56/56843_634166-lq.mp3');
fireSound.volume = 0.3;

const enemyDeathSound = new Audio('https://freesound.org/data/previews/49/49950_634166-lq.mp3');
enemyDeathSound.volume = 0.3;

const powerupSound = new Audio('https://freesound.org/data/previews/331/331912_3248244-lq.mp3');
powerupSound.volume = 0.3;

const blastSound = new Audio('https://freesound.org/data/previews/273/273177_5121236-lq.mp3');
blastSound.volume = 0.3;

const slowSound = new Audio('https://freesound.org/data/previews/161/161996_3248244-lq.mp3');
slowSound.volume = 0.3;

// Constants
const MAX_HEALTH = 120;
const PLAYER_RADIUS = 18;
const BULLET_SPEED = 8;

// Helper function: Distance between two points
function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// --- Classes ---

// Particle for effects
class Particle {
  constructor(x, y, vx, vy, color, radius, life) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.radius = radius;
    this.life = life; // ms
    this.age = 0;
  }
  update(dt) {
    this.x += this.vx;
    this.y += this.vy;
    this.age += dt;
  }
  isDead() {
    return this.age >= this.life;
  }
  draw() {
    ctx.save();
    ctx.globalAlpha = 1 - this.age / this.life;
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Weapon class with leveling
class Weapon {
  constructor(name, damage, fireRate, specialEffect = null) {
    this.name = name;
    this.damage = damage;
    this.fireRate = fireRate;
    this.level = 1;
    this.experience = 0;
    this.cooldown = 0;
    this.specialEffect = specialEffect; // slow, explosion, etc.
  }
  shoot(x, y, targetX, targetY, bullets) {
    if (this.cooldown > 0) return false;
    this.cooldown = this.fireRate;
    let angle = Math.atan2(targetY - y, targetX - x);
    bullets.push(new Bullet(x, y, angle, this.damage, this.specialEffect));
    fireSound.play();
    return true;
  }
  updateCooldown(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
  }
  addExperience(amount) {
    this.experience += amount;
    if (this.experience >= 100) {
      this.levelUp();
      this.experience = 0;
    }
  }
  levelUp() {
    this.level++;
    this.damage = Math.round(this.damage * 1.15);
    this.fireRate *= 0.9;
  }
}

// Bullet class
class Bullet {
  constructor(x, y, angle, damage, special) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * BULLET_SPEED;
    this.vy = Math.sin(angle) * BULLET_SPEED;
    this.damage = damage;
    this.radius = 5;
    this.special = special;
    this.color = special === 'slow' ? '#60a5fa' : special === 'explosion' ? '#f97316' : '#eee';
    this.owner = 'player';
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
  }
  outOfBounds() {
    return this.x < -10 || this.x > WIDTH + 10 || this.y < -10 || this.y > HEIGHT + 10;
  }
  draw() {
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Player class
class Player {
  constructor() {
    this.x = WIDTH / 2;
    this.y = HEIGHT / 2;
    this.radius = PLAYER_RADIUS;
    this.color = '#f97316';
    this.health = MAX_HEALTH;
    this.shield = 0;
    this.speed = 4;
    this.speedBuff = 0;
    this.weapons = [
      new Weapon('Basit Silah', 12, 250),
      new Weapon('Hızlı Silah', 8, 150),
      new Weapon('Patlayıcı Silah', 10, 400, 'explosion'),
      new Weapon('Yavaşlatıcı Silah', 6, 300, 'slow'),
      new Weapon('Güçlü Silah', 20, 700),
    ];
    this.weaponIndex = 0;
    this.exp = 0;
    this.level = 1;
    this.skillPoints = 0;
    this.blastCharges = 1;
    this.slowCharges = 1;
    this.flashTimer = 0;
  }
  update(dt) {
    let spd = this.speed + this.speedBuff;
    if (keys['w'] || keys['arrowup']) this.y -= spd;
    if (keys['s'] || keys['arrowdown']) this.y += spd;
    if (keys['a'] || keys['arrowleft']) this.x -= spd;
    if (keys['d'] || keys['arrowright']) this.x += spd;

    // Canvas sınırları
    this.x = Math.min(WIDTH - this.radius, Math.max(this.radius, this.x));
    this.y = Math.min(HEIGHT - this.radius, Math.max(this.radius, this.y));

    if (this.flashTimer > 0) this.flashTimer -= dt;
    
    // Weapon cooldown update
    this.weapons[this.weaponIndex].updateCooldown(dt);
  }
  draw() {
    ctx.save();
    if (this.flashTimer > 0) {
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 18;
    } else {
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 10;
    }
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Shield glow
    if (this.shield > 0) {
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  shoot() {
    let weapon = this.weapons[this.weaponIndex];
    if (weapon.shoot(this.x, this.y, mousePos.x, mousePos.y, bullets)) {
      createMuzzleFlash(this.x, this.y, Math.atan2(mousePos.y - this.y, mousePos.x - this.x));
    }
  }
  switchWeapon() {
    this.weaponIndex = (this.weaponIndex + 1) % this.weapons.length;
  }
  gainExp(amount) {
    this.exp += amount;
    if (this.exp >= this.expToNextLevel()) {
      this.levelUp();
    }
  }
  levelUp() {
    this.level++;
    this.exp = 0;
    this.skillPoints += 2;
    this.health = Math.min(MAX_HEALTH, this.health + 20);
    this.speed += 0.3;
  }
  expToNextLevel() {
    return 100 + (this.level - 1) * 50;
  }
  flashDamage() {
    this.flashTimer = 120;
  }
  useBlast() {
    if (this.blastCharges > 0) {
      this.blastCharges--;
      blastSound.play();
      enemies.forEach((e) => {
        e.health -= 30 + currentLevel * 5;
        e.flashDamage();
      });
    }
  }
  useSlow() {
    if (this.slowCharges > 0) {
      this.slowCharges--;
      slowSound.play();
      slowMotionTimer = 3000;
    }
  }
  collide(obj) {
    return distance(this, obj) < this.radius + (obj.radius || 0);
  }
}

// Enemy class with AI
class Enemy {
  constructor(x, y, type = 'normal') {
    this.x = x;
    this.y = y;
    this.radius = 16;
    this.color = '#f87171';
    this.health = 50;
    this.maxHealth = 50;
    this.speed = currentDifficulty.enemySpeed;
    this.type = type;
    this.flashTimer = 0;
    this.shield = 0;
    this.damage = currentDifficulty.enemyDamage;
    this.aiState = 'chase'; // chase, flee, group
  }
  update(dt) {
    let angle;
    if (this.type === 'tank') {
      this.radius = 22;
      this.color = '#dc2626';
      this.maxHealth = 120 * currentDifficulty.enemyHealthMultiplier;
      this.health = Math.min(this.health, this.maxHealth);
      this.speed = currentDifficulty.enemySpeed * 0.7;
      angle = Math.atan2(player.y - this.y, player.x - this.x);
      // Tank düşmanlar diğerlerini korumaya çalışıyor
      let alliesNearby = enemies.filter(e => e !== this && distance(this, e) < 80);
      if (alliesNearby.length > 0) {
        this.speed = currentDifficulty.enemySpeed * 0.5;
        if (this.shield <= 0) this.shield = 20;
      } else {
        this.speed = currentDifficulty.enemySpeed * 0.7;
      }
    } else if (this.type === 'splitter') {
      this.radius = 14;
      this.color = '#fb923c';
      this.speed = currentDifficulty.enemySpeed * 1.5;
      angle = Math.atan2(player.y - this.y, player.x - this.x);
    } else if (this.type === 'shielder') {
      this.radius = 18;
      this.color = '#2563eb';
      this.speed = currentDifficulty.enemySpeed * 0.8;
      if (this.shield <= 0) this.shield = 30;
      angle = Math.atan2(player.y - this.y, player.x - this.x);
    } else {
      angle = Math.atan2(player.y - this.y, player.x - this.x);
    }
    // Hareket
    this.x += Math.cos(angle) * this.speed;
    this.y += Math.sin(angle) * this.speed;

    // Sınırlar
    this.x = Math.min(WIDTH - this.radius, Math.max(this.radius, this.x));
    this.y = Math.min(HEIGHT - this.radius, Math.max(this.radius, this.y));

    if (this.flashTimer > 0) this.flashTimer -= dt;
  }
  draw() {
    ctx.save();
    ctx.fillStyle = this.color;
    if (this.flashTimer > 0) {
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#fff';
    }
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Shield glow
    if (this.shield > 0) {
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Health bar
    const barWidth = this.radius * 2;
    const barHeight = 6;
    const healthPercent = this.health / this.maxHealth;
    ctx.fillStyle = '#ff4d4d';
    ctx.fillRect(this.x - this.radius, this.y - this.radius - 14, barWidth, barHeight);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(this.x - this.radius, this.y - this.radius - 14, barWidth * healthPercent, barHeight);

    ctx.restore();
  }
  takeDamage(damage) {
    if (this.shield > 0) {
      this.shield -= damage;
      if (this.shield < 0) this.health += this.shield; // kalan damage health'e yansır
      if (this.shield < 0) this.shield = 0;
    } else {
      this.health -= damage;
    }
    this.flashTimer = 100;
  }
  isDead() {
    return this.health <= 0;
  }
  flashDamage() {
    this.flashTimer = 120;
  }
}

// Power-up class
class PowerUp {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.radius = 14;
    this.type = type; // heal, shield, speed, exp, blast, slow
    this.color = {
      heal: '#22c55e',
      shield: '#60a5fa',
      speed: '#fbbf24',
      exp: '#a78bfa',
      blast: '#ef4444',
      slow: '#3b82f6',
    }[type] || '#fff';
  }
  draw() {
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  apply(player) {
    switch (this.type) {
      case 'heal': player.health = Math.min(MAX_HEALTH, player.health + 30); break;
      case 'shield': player.shield = 30; break;
      case 'speed': player.speedBuff = 1.5; setTimeout(() => player.speedBuff = 0, 5000); break;
      case 'exp': player.gainExp(40); break;
      case 'blast': player.blastCharges++; break;
      case 'slow': player.slowCharges++; break;
    }
  }
}

// Muzzle flash effect for shooting
const muzzleParticles = [];
function createMuzzleFlash(x, y, angle) {
  for(let i=0; i<8; i++) {
    const speed = Math.random()*2 + 1;
    const spread = (Math.random()-0.5) * 0.6;
    muzzleParticles.push(new Particle(
      x + Math.cos(angle)*18,
      y + Math.sin(angle)*18,
      Math.cos(angle + spread) * speed,
      Math.sin(angle + spread) * speed,
      '#f97316',
      3,
      200
    ));
  }
}

// Global game objects
const player = new Player();
const bullets = [];
const enemies = [];
const powerUps = [];
const particles = [];

// Save & Load
function saveGame() {
  const saveData = {
    score,
    currentLevel,
    player: {
      x: player.x,
      y: player.y,
      health: player.health,
      level: player.level,
      exp: player.exp,
      skillPoints: player.skillPoints,
      speed: player.speed,
      blastCharges: player.blastCharges,
      slowCharges: player.slowCharges,
      weaponIndex: player.weaponIndex,
      weapons: player.weapons.map(w => ({
        name: w.name,
        damage: w.damage,
        fireRate: w.fireRate,
        level: w.level,
        experience: w.experience,
        specialEffect: w.specialEffect
      })),
    },
    difficulty: difficultySelect.value,
  };
  localStorage.setItem('brotatoSave', JSON.stringify(saveData));
}

function loadGame() {
  const data = JSON.parse(localStorage.getItem('brotatoSave'));
  if (!data) return;
  score = data.score || 0;
  currentLevel = data.currentLevel || 1;
  player.x = data.player.x || WIDTH/2;
  player.y = data.player.y || HEIGHT/2;
  player.health = data.player.health || MAX_HEALTH;
  player.level = data.player.level || 1;
  player.exp = data.player.exp || 0;
  player.skillPoints = data.player.skillPoints || 0;
  player.speed = data.player.speed || 4;
  player.blastCharges = data.player.blastCharges || 1;
  player.slowCharges = data.player.slowCharges || 1;
  player.weaponIndex = data.player.weaponIndex || 0;

  player.weapons = [];
  for (let w of data.player.weapons) {
    const weapon = new Weapon(w.name, w.damage, w.fireRate, w.specialEffect);
    weapon.level = w.level;
    weapon.experience = w.experience;
    player.weapons.push(weapon);
  }

  if (data.difficulty && difficulties[data.difficulty]) {
    currentDifficulty = difficulties[data.difficulty];
    difficultySelect.value = data.difficulty;
  }
}

// Spawn enemy based on level & difficulty
function spawnEnemy() {
  const edge = Math.floor(Math.random() * 4);
  let x, y;
  switch(edge) {
    case 0: x = Math.random() * WIDTH; y = -30; break;
    case 1: x = WIDTH + 30; y = Math.random() * HEIGHT; break;
    case 2: x = Math.random() * WIDTH; y = HEIGHT + 30; break;
    case 3: x = -30; y = Math.random() * HEIGHT; break;
  }

  // Enemy type probabilities
  let type = 'normal';
  const r = Math.random();
  if (r < 0.1 && currentLevel >= 3) type = 'tank';
  else if (r < 0.25 && currentLevel >= 5) type = 'shielder';
  else if (r < 0.4 && currentLevel >= 4) type = 'splitter';

  const enemy = new Enemy(x, y, type);
  enemy.health *= currentDifficulty.enemyHealthMultiplier;
  enemy.maxHealth = enemy.health;
  enemies.push(enemy);
}

// Spawn power-up randomly
function spawnPowerUp() {
  const x = Math.random() * (WIDTH - 60) + 30;
  const y = Math.random() * (HEIGHT - 60) + 30;
  const types = ['heal','shield','speed','exp','blast','slow'];
  let type = types[Math.floor(Math.random() * types.length)];
  powerUps.push(new PowerUp(x,y,type));
  powerupSound.play();
}

// Update leaderboard in menu
function updateLeaderboard() {
  let data = JSON.parse(localStorage.getItem('brotatoLeaderboard')) || [];
  data.push({score, level: currentLevel, date: new Date().toLocaleDateString()});
  data.sort((a,b) => b.score - a.score);
  data = data.slice(0, 8);
  localStorage.setItem('brotatoLeaderboard', JSON.stringify(data));
  
  leaderboardDiv.innerHTML = '<h3>Skor Tablosu</h3>';
  for (let i = 0; i < data.length; i++) {
    leaderboardDiv.innerHTML += `<div>${i+1}. Skor: ${data[i].score} - Seviye: ${data[i].level} - ${data[i].date}</div>`;
  }
}

// Game over handling
function gameOver() {
  gameRunning = false;
  updateLeaderboard();
  menu.style.display = 'block';
  alert(`Oyun bitti! Skorunuz: ${score}`);
  saveGame();
}

// Main game loop
function gameLoop(timestamp) {
  if (!gameRunning) return;
  if (!lastFrameTime) lastFrameTime = timestamp;
  deltaTime = timestamp - lastFrameTime;
  lastFrameTime = timestamp;

  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // Level transition effect
  if(levelTransition){
    levelTransitionTime += deltaTime;
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, levelTransitionTime / levelTransitionDuration)})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    if(levelTransitionTime > levelTransitionDuration){
      levelTransition = false;
      levelTransitionTime = 0;
      currentLevel++;
      spawnInterval = Math.max(700, spawnInterval - 200);
    }
  }

  // Update player
  player.update(deltaTime);

  // Draw player
  player.draw();

  // Shoot if mouse down
  if(mouseDown){
    player.shoot();
  }

  // Update bullets
  for(let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.update();
    b.draw();

    // Remove if out of bounds
    if(b.outOfBounds()){
      bullets.splice(i, 1);
      continue;
    }

    // Check collision with enemies
    for(let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if(distance(b, e) < e.radius + b.radius){
        e.takeDamage(b.damage);
        if(b.special === 'slow'){
          slowMotionTimer = 2500;
        }
        if(b.special === 'explosion'){
          createExplosion(e.x, e.y, 3);
          enemies.forEach(other => {
            if(other !== e && distance(e, other) < 80){
              other.takeDamage(b.damage / 2);
            }
          });
        }
        bullets.splice(i,1);
        if(e.isDead()){
          enemyDeathSound.play();
          score += 10 * currentLevel;
          player.gainExp(12);
          // Spawn powerup randomly
          if(Math.random() < currentDifficulty.powerUpRate / 4) spawnPowerUp();
          enemies.splice(j,1);
        }
        break;
      }
    }
  }

  // Update enemies
  enemies.forEach(enemy => {
    enemy.update(deltaTime);
    enemy.draw();

    // Enemy touching player?
    if(player.collide(enemy)){
      player.health -= enemy.damage;
      player.flashDamage();
      enemy.flashDamage();
      if(player.health <= 0){
        gameOver();
      }
    }
  });

  // Update powerups
  for(let i = powerUps.length -1; i >= 0; i--) {
    let p = powerUps[i];
    p.draw();
    if(player.collide(p)){
      p.apply(player);
      powerUps.splice(i,1);
    }
  }

  // Update particles (muzzle flash, explosions, etc)
  for(let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.update(deltaTime);
    if(p.isDead()) particles.splice(i, 1);
    else p.draw();
  }

  for(let i = muzzleParticles.length -1; i >= 0; i--) {
    let p = muzzleParticles[i];
    p.update(deltaTime);
    if(p.isDead()) muzzleParticles.splice(i, 1);
    else p.draw();
  }

  // Slow motion timer
  if(slowMotionTimer > 0){
    slowMotionTimer -= deltaTime;
  }

  // Spawn enemies
  if(!levelTransition && (timestamp - lastSpawnTime > spawnInterval)){
    spawnEnemy();
    lastSpawnTime = timestamp;
  }

  // Spawn powerups occasionally
  if(timestamp - lastPowerUpTime > 12000){
    spawnPowerUp();
    lastPowerUpTime = timestamp;
  }

  // Level up check
  if(score > levelScoreThreshold * currentLevel && !levelTransition){
    levelTransition = true;
    levelTransitionTime = 0;
  }

  // Update UI
  scoreDisplay.textContent = 'Skor: ' + score;
  healthDisplay.textContent = 'Can: ' + Math.round(player.health);
  weaponDisplay.textContent = 'Silah: ' + player.weapons[player.weaponIndex].name + ' (Lv. ' + player.weapons[player.weaponIndex].level + ')';
  levelDisplay.textContent = 'Seviye: ' + player.level;
  expDisplay.textContent = `Deneyim: ${player.exp} / ${player.expToNextLevel()}`;

  // İlerlemeyi otomatik kaydet
  if(timestamp % 10000 < 20) {
    saveGame();
  }

  requestAnimationFrame(gameLoop);
}

// Explosion effect
function createExplosion(x, y, count){
  for(let i=0; i<count*5; i++){
    const angle = Math.random()*Math.PI*2;
    const speed = Math.random()*3 + 1;
    particles.push(new Particle(x, y, Math.cos(angle)*speed, Math.sin(angle)*speed, '#f97316', 4, 600));
  }
}

// Input Events
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mousePos.x = e.clientX - rect.left;
  mousePos.y = e.clientY - rect.top;
});

canvas.addEventListener('mousedown', (e) => {
  mouseDown = true;
});

canvas.addEventListener('mouseup', (e) => {
  mouseDown = false;
});

window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;

  if(e.key === ' ') {
    player.useBlast();
  }
  if(e.key === 'Shift') {
    player.useSlow();
  }
  if(e.key === 'q' || e.key === 'Q') {
    player.switchWeapon();
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

// UI Buttons
startBtn.addEventListener('click', () => {
  menu.style.display = 'none';
  settingsDiv.style.display = 'none';
  resetGame();
  gameRunning = true;
  lastFrameTime = 0;
  bgMusic.play();
  requestAnimationFrame(gameLoop);
});

settingsBtn.addEventListener('click', () => {
  settingsDiv.style.display = 'block';
});

closeSettingsBtn.addEventListener('click', () => {
  settingsDiv.style.display = 'none';
});

difficultySelect.addEventListener('change', () => {
  const val = difficultySelect.value;
  currentDifficulty = difficulties[val];
});

// Volume control
volumeSlider.addEventListener('input', () => {
  const v = volumeSlider.value;
  bgMusic.volume = v;
  fireSound.volume = v;
  enemyDeathSound.volume = v;
  powerupSound.volume = v;
  blastSound.volume = v;
  slowSound.volume = v;
});

// Reset game
function resetGame(){
  score = 0;
  currentLevel = 1;
  player.health = MAX_HEALTH;
  player.exp = 0;
  player.level = 1;
  player.skillPoints = 0;
  player.speed = 4;
  player.blastCharges = 1;
  player.slowCharges = 1;
  player.weaponIndex = 0;
  player.x = WIDTH / 2;
  player.y = HEIGHT / 2;
  enemies.length = 0;
  bullets.length = 0;
  powerUps.length = 0;
  particles.length = 0;
  muzzleParticles.length = 0;
  spawnInterval = 2000;
  lastSpawnTime = 0;
  lastPowerUpTime = 0;
  levelTransition = false;
  slowMotionTimer = 0;
}

// Load saved game on load
window.onload = () => {
  loadGame();
  menu.style.display = 'block';
  updateLeaderboard();
};

