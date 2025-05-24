class Platformer extends Phaser.Scene {
    constructor() {
        super("platformerScene");
    }

    init() {
        // variables and settings
        this.ACCELERATION = 400;
        this.DRAG = 500;    // DRAG < ACCELERATION = icy slide
        this.physics.world.gravity.y = 1500;
        this.JUMP_VELOCITY = -600;
        this.WALL_JUMP_VELOCITY = {
            x: 300,   // Horizontal boost from wall
            y: -500   // Vertical boost from wall
        };
        this.PARTICLE_VELOCITY = 50;
        this.SCALE = 2.0;
        
        // Health system
        this.PLAYER_CONFIG = {
            maxHealth: 10,
            currentHealth: 10,
            damageAmount: 1
        };
        
        // Jump mechanics
        this.MAX_JUMPS = 2;
        this.jumpsLeft = this.MAX_JUMPS;
        this.isWallSliding = false;
        this.wallSlideSpeed = 100;
        this.WALL_SLIDE_THRESHOLD = 150;
        
        // Game state
        this.coinsCollected = 0;
        this.totalCoins = 0;
        this.lastHeight = 0;
        this.SHAKE_THRESHOLD = 100;
        
        // Store last camera position for delta calculations
        this.lastCameraPos = { x: 0, y: 0 };

        // Initialize VFX container
        if (!my.vfx) {
            my.vfx = {
                running: null,
                jumping: null,
                landing: null,
                wallSlide: null
            };
        }

        // Camera settings
        this.CAMERA_SETTINGS = {
            lerp: 0.1,
            deadzoneBasic: {
                width: 200,
                height: 100
            },
            deadzoneRunning: {
                width: 300,  // Wider deadzone when running
                height: 150
            },
            verticalTransitionSpeed: 0.5,
            panSpeed: 0.05
        };
        
        // Camera state tracking
        this.cameraState = {
            isTransitioning: false,
            targetY: 0,
            previousPlayerY: 0,
            verticalOffset: 0
        };

        // Enemy configuration
        this.ENEMY_CONFIG = {
            patrol: {
                speed: 75,
                damage: 20,
                count: 3,  // Fixed number of enemies
                patrolDistance: 150
            }
        };
    }

    create() {
        console.log('Creating platformer scene...');

        // Initialize game state
        this.coinsCollected = 0;
        this.totalCoins = 0;
        this.lastHeight = 0;
        this.SHAKE_THRESHOLD = 100;

        // Load the tilemap
        this.map = this.add.tilemap("platformer-level-1");
        console.log('Tilemap loaded');

        // Add the tilesets
        this.tileset = this.map.addTilesetImage("kenny_tilemap_packed", "tilemap_tiles");
        this.backgroundTileset = this.map.addTilesetImage("tilemap-backgrounds_packed", "background_tiles");
        console.log('Tilesets added');

        // Create layers in correct order
        // 1. Sky layer (background)
        this.skyLayer = this.map.createLayer("sky", this.backgroundTileset, 0, 0);
        this.skyLayer.setScale(1.5);
        this.skyLayer.setScrollFactor(0.85);
        console.log('Sky layer created');

        // 2. Trees layer (decorative)
        this.treesLayer = this.map.createLayer("trees", this.tileset, 0, 0);
        this.treesLayer.setScale(1.0);
        this.treesLayer.setDepth(1);
        this.treesLayer.setScrollFactor(1);
        console.log('Trees layer created');

        // 3. Ground and platforms (drawn above trees)
        this.groundLayer = this.map.createLayer("Ground-n-Platforms", this.tileset, 0, 0);
        this.groundLayer.setDepth(2);
        console.log('Ground layer created');

        // Make ground/platforms collidable
        this.groundLayer.setCollisionByProperty({ collides: true });

        // Add ambient particles (floating dust/magic)
        this.ambientParticles = this.add.particles(0, 0, "kenny-particles", {
            frame: ['smoke_01.png'],
            x: { min: 0, max: game.config.width },
            y: { min: 0, max: game.config.height },
            quantity: 1,
            frequency: 2000,
            lifespan: 6000,
            alpha: { start: 0.2, end: 0 },
            scale: { start: 0.1, end: 0.3 },
            speed: { min: 10, max: 30 },
            angle: { min: 0, max: 360 },
            blendMode: 'ADD'
        });
        this.ambientParticles.setDepth(1.5); // Between trees and ground

        // --- COINS ---
        this.coins = this.map.createFromObjects("Objects", {
            name: "coin",
            key: "tilemap_sheet",
            frame: 151
        });
        this.physics.world.enable(this.coins, Phaser.Physics.Arcade.STATIC_BODY);
        this.coinGroup = this.add.group(this.coins);
        this.totalCoins = this.coins.length;
        
        // Set depth for coins to appear above ground
        this.coins.forEach(coin => {
            coin.setDepth(3);
        });

        // Add coin counter UI
        this.coinText = this.add.text(16, 16, 
            `Coins: ${this.coinsCollected}/${this.totalCoins}`,
            { fontSize: '32px', fill: '#fff', backgroundColor: '#000' }
        ).setScrollFactor(0).setDepth(10);

        // Create health bar
        this.createHealthBar();

        // --- PLAYER ---
        my.sprite.player = this.physics.add.sprite(30, 345, "platformer_characters", "tile_0000.png");
        my.sprite.player.setCollideWorldBounds(true);
        my.sprite.player.setDepth(4);
        
        // Set up player physics for wall sliding
        my.sprite.player.setFriction(0, 0);
        my.sprite.player.setBounce(0);
        my.sprite.player.body.setSize(my.sprite.player.width * 0.7, my.sprite.player.height);
        
        // Track wall touching state
        my.sprite.player.body.onWorldBounds = true;
        
        // Wall slide particles
        my.vfx.wallSlide = this.add.particles(0, 0, "kenny-particles", {
            frame: ['smoke_01.png'],
            lifespan: 200,
            speed: { min: 5, max: 15 },
            scale: { start: 0.05, end: 0 },
            alpha: { start: 0.3, end: 0 },
            gravityY: 50,
            quantity: 1,
            frequency: 100,
            emitting: false
        });
        my.vfx.wallSlide.setDepth(3.5);
        my.vfx.wallSlide.stop();

        // Collisions
        this.physics.add.collider(my.sprite.player, this.groundLayer);

        // Coin collection with enhanced effects
        this.physics.add.overlap(my.sprite.player, this.coinGroup, (obj1, obj2) => {
            // Store camera position before destroying coin
            const currentScroll = {
                x: this.cameras.main.scrollX,
                y: this.cameras.main.scrollY
            };
            
            // Play coin collection sound
            this.sound.play('coinSound', { volume: 0.4 });
            
            obj2.destroy();
            this.coinsCollected++;
            this.coinText.setText(`Coins: ${this.coinsCollected}/${this.totalCoins}`);
            
            // Restore camera position
            this.cameras.main.setScroll(currentScroll.x, currentScroll.y);
            
            // Check for win condition
            if (this.coinsCollected === this.totalCoins) {
                this.showWinScreen();
            }
        });

        // --- INPUT ---
        cursors = this.input.keyboard.createCursorKeys();
        this.rKey = this.input.keyboard.addKey('R');

        // Disable physics debug display
        this.physics.world.debugGraphic.destroy();
        this.physics.world.drawDebug = false;

        // --- PARTICLE EFFECTS ---
        // Running particles
        my.vfx.running = this.add.particles(0, 0, "kenny-particles", {
            frame: ['smoke_01.png'],
            lifespan: 200,
            speed: { min: 10, max: 30 },
            scale: { start: 0.05, end: 0 },
            alpha: { start: 0.5, end: 0 },
            gravityY: 0,
            quantity: 1,
            frequency: 100,
            emitting: false
        });
        my.vfx.running.setDepth(3.5);

        // Jump particles
        my.vfx.jumping = this.add.particles(0, 0, "kenny-particles", {
            frame: ['circle_05.png'],
            lifespan: 400,
            speed: { min: 20, max: 40 },
            scale: { start: 0.1, end: 0 },
            alpha: { start: 0.6, end: 0 },
            gravityY: 200,
            quantity: 8,
            frequency: -1,
            emitting: false
        });
        my.vfx.jumping.setDepth(3.5);

        // Landing particles
        my.vfx.landing = this.add.particles(0, 0, "kenny-particles", {
            frame: ['circle_03.png'],
            lifespan: 300,
            speedX: { min: -50, max: 50 },
            speedY: { min: -20, max: 20 },
            scale: { start: 0.1, end: 0 },
            alpha: { start: 0.6, end: 0 },
            quantity: 10,
            frequency: -1,
            emitting: false
        });
        my.vfx.landing.setDepth(3.5);

        // --- UI ---
        this.storyText = this.add.text(16, 16, 
            "Collect all the magical coins to restore balance to the kingdom!", 
            { fontSize: '16px', fill: '#fff', backgroundColor: '#000' }
        ).setScrollFactor(0).setDepth(10);
        
        // Health display
        this.healthDisplay = this.add.group();
        this.updateHealthDisplay();
        
        // Create health bar
        this.createHealthBar();
        
        // --- CAMERA ---
        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        this.cameras.main.startFollow(my.sprite.player, true, 
            this.CAMERA_SETTINGS.lerp, 
            this.CAMERA_SETTINGS.lerp
        );
        
        // Set initial deadzone
        this.updateCameraDeadzone(false);
        
        this.cameras.main.setZoom(this.SCALE);
        
        // Store initial player position for vertical tracking
        this.cameraState.previousPlayerY = my.sprite.player.y;
        
        // Track if player was on ground in previous frame
        this.wasOnGround = true;
        
        // Create enemies group with physics
        this.enemies = this.physics.add.group({
            allowGravity: true,
            collideWorldBounds: true
        });

        // Set up enemies
        this.setupEnemies();

        // Add colliders
        this.physics.add.collider(this.enemies, this.groundLayer);
        this.physics.add.overlap(my.sprite.player, this.enemies, this.handleEnemyCollision, null, this);
        
        console.log('Platformer scene setup complete');
    }

    updateCameraDeadzone(isRunning) {
        const deadzone = isRunning ? 
            this.CAMERA_SETTINGS.deadzoneRunning : 
            this.CAMERA_SETTINGS.deadzoneBasic;
            
        this.cameras.main.setDeadzone(
            deadzone.width,
            deadzone.height
        );
    }

    updateCamera() {
        // Check if player is moving fast horizontally
        const isRunning = Math.abs(my.sprite.player.body.velocity.x) > this.ACCELERATION / 2;
        this.updateCameraDeadzone(isRunning);

        // Vertical camera adjustment
        const playerVerticalSpeed = my.sprite.player.body.velocity.y;
        const verticalDelta = my.sprite.player.y - this.cameraState.previousPlayerY;
        
        // Detect significant vertical movement
        if (Math.abs(playerVerticalSpeed) > Math.abs(this.JUMP_VELOCITY / 2)) {
            // Player is moving vertically fast (jumping or falling)
            this.cameraState.isTransitioning = true;
            this.cameraState.targetY = my.sprite.player.y - (this.cameras.main.height / 4);
        }

        // Smooth vertical transition
        if (this.cameraState.isTransitioning) {
            const currentScrollY = this.cameras.main.scrollY;
            const targetDelta = this.cameraState.targetY - currentScrollY;
            
            if (Math.abs(targetDelta) < 1) {
                this.cameraState.isTransitioning = false;
            } else {
                this.cameras.main.scrollY += targetDelta * this.CAMERA_SETTINGS.verticalTransitionSpeed;
            }
        }

        // Look ahead in movement direction
        if (isRunning) {
            const lookAheadX = my.sprite.player.body.velocity.x > 0 ? 100 : -100;
            this.cameras.main.followOffset.x = Phaser.Math.Linear(
                this.cameras.main.followOffset.x,
                lookAheadX,
                this.CAMERA_SETTINGS.panSpeed
            );
        } else {
            // Center when not running
            this.cameras.main.followOffset.x = Phaser.Math.Linear(
                this.cameras.main.followOffset.x,
                0,
                this.CAMERA_SETTINGS.panSpeed
            );
        }

        // Store current position for next frame
        this.cameraState.previousPlayerY = my.sprite.player.y;
    }

    update() {
        // Handle player movement
        if(cursors.left.isDown) {
            my.sprite.player.setAccelerationX(-this.ACCELERATION);
            my.sprite.player.resetFlip();
            my.sprite.player.anims.play('walk', true);

            if (my.sprite.player.body.blocked.down && my.vfx.running) {
                my.vfx.running.startFollow(
                    my.sprite.player,
                    my.sprite.player.width/2,
                    my.sprite.player.height-2
                );
                my.vfx.running.start();
            }
        } else if(cursors.right.isDown) {
            my.sprite.player.setAccelerationX(this.ACCELERATION);
            my.sprite.player.setFlip(true, false);
            my.sprite.player.anims.play('walk', true);

            if (my.sprite.player.body.blocked.down && my.vfx.running) {
                my.vfx.running.startFollow(
                    my.sprite.player,
                    -my.sprite.player.width/2,
                    my.sprite.player.height-2
                );
                my.vfx.running.start();
            }
        } else {
            my.sprite.player.setAccelerationX(0);
            my.sprite.player.setDragX(this.DRAG);
            my.sprite.player.anims.play('idle');
            if (my.vfx.running) {
                my.vfx.running.stop();
            }
        }

        // Reset jumps when touching ground
        if (my.sprite.player.body.blocked.down) {
            this.jumpsLeft = this.MAX_JUMPS;
            this.isWallSliding = false;
            if (my.vfx.wallSlide) {
                my.vfx.wallSlide.stop();
            }
        }

        // Wall slide logic
        const isTouchingWall = my.sprite.player.body.blocked.left || my.sprite.player.body.blocked.right;
        const isMovingDown = my.sprite.player.body.velocity.y > this.WALL_SLIDE_THRESHOLD;

        if (isTouchingWall && !my.sprite.player.body.blocked.down && isMovingDown) {
            this.isWallSliding = true;
            my.sprite.player.setVelocityY(this.wallSlideSpeed);
            
            if (my.vfx.wallSlide && !my.vfx.wallSlide.emitting) {
                const particleX = my.sprite.player.body.blocked.left ? 
                    my.sprite.player.width/2 : -my.sprite.player.width/2;
                
                my.vfx.wallSlide.startFollow(my.sprite.player);
                my.vfx.wallSlide.followOffset.x = particleX;
                my.vfx.wallSlide.start();
            }
        } else {
            this.isWallSliding = false;
            if (my.vfx.wallSlide && my.vfx.wallSlide.emitting) {
                my.vfx.wallSlide.stop();
            }
        }

        // Jump logic
        if (Phaser.Input.Keyboard.JustDown(cursors.up)) {
            if (this.isWallSliding) {
                // Wall jump
                const wallDirection = my.sprite.player.body.blocked.left ? 1 : -1;
                my.sprite.player.setVelocityX(this.WALL_JUMP_VELOCITY.x * wallDirection);
                my.sprite.player.setVelocityY(this.WALL_JUMP_VELOCITY.y);
                this.jumpsLeft = this.MAX_JUMPS - 1; // Allow one more jump after wall jump
                this.sound.play('jumpSound', { volume: 0.3 });
                
                // Wall jump particles
                my.vfx.jumping.emitParticleAt(
                    my.sprite.player.x,
                    my.sprite.player.y + my.sprite.player.height/2
                );
            } else if (this.jumpsLeft > 0) {
                // Normal jump or double jump
                my.sprite.player.setVelocityY(this.JUMP_VELOCITY);
                this.jumpsLeft--;
                this.sound.play('jumpSound', { volume: 0.3 });
                
                // Jump particles
                my.vfx.jumping.emitParticleAt(
                    my.sprite.player.x,
                    my.sprite.player.y + my.sprite.player.height/2
                );
            }
        }

        if(!my.sprite.player.body.blocked.down) {
            my.sprite.player.anims.play('jump');
        }

        // Landing check
        if (!this.wasOnGround && my.sprite.player.body.blocked.down) {
            my.vfx.landing.emitParticleAt(
                my.sprite.player.x,
                my.sprite.player.y + my.sprite.player.height/2
            );
            this.sound.play('landSound', { volume: 0.2 });
            
            const fallDistance = this.lastHeight - my.sprite.player.y;
            if (fallDistance > this.SHAKE_THRESHOLD) {
                this.cameras.main.shake(100, 0.005);
            }
        }
        
        if (!my.sprite.player.body.blocked.down) {
            this.lastHeight = my.sprite.player.y;
        }
        this.wasOnGround = my.sprite.player.body.blocked.down;

        // Update camera behavior
        this.updateCamera();

        // Update health bar position
        this.updateHealthBar();

        // Update enemies
        this.enemies.children.iterate((enemy) => {
            if (!enemy) return;

            // Check if enemy has reached patrol limits
            const distanceFromStart = Math.abs(enemy.x - enemy.startX);
            
            if (distanceFromStart >= enemy.patrolDistance) {
                // Reverse direction
                enemy.direction *= -1;
                enemy.setVelocityX(this.ENEMY_CONFIG.patrol.speed * enemy.direction);
                enemy.setFlipX(enemy.direction > 0);
                enemy.startX = enemy.x; // Reset start position for next patrol
            }

            // Check for edges
            const groundCheck = this.groundLayer.getTileAtWorldXY(
                enemy.x + (32 * enemy.direction), 
                enemy.y + 40
            );

            if (!groundCheck) {
                // Reverse at edges
                enemy.direction *= -1;
                enemy.setVelocityX(this.ENEMY_CONFIG.patrol.speed * enemy.direction);
                enemy.setFlipX(enemy.direction > 0);
                enemy.startX = enemy.x;
            }
        });

        if(Phaser.Input.Keyboard.JustDown(this.rKey)) {
            this.scene.restart();
        }
    }

    showWinScreen() {
        // Play victory sound
        this.sound.play('victorySound', { volume: 0.5 });

        // Create semi-transparent black overlay
        const overlay = this.add.rectangle(
            this.cameras.main.scrollX,
            this.cameras.main.scrollY,
            this.cameras.main.width / this.SCALE,
            this.cameras.main.height / this.SCALE,
            0x000000, 0.7
        ).setOrigin(0).setScrollFactor(0).setDepth(19);
        overlay.setScale(this.SCALE);

        // Victory text
        const victoryText = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2 - 30,
            'Victory!\nYou have restored balance to the kingdom!',
            { 
                fontSize: '24px', 
                fill: '#fff', 
                align: 'center',
                backgroundColor: '#000000',
                padding: { x: 15, y: 8 },
                wordWrap: { width: this.cameras.main.width - 100 }
            }
        ).setOrigin(0.5)
         .setScrollFactor(0)
         .setDepth(20);

        // Restart instructions
        const restartText = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2 + 30,
            'Press R to play again',
            { 
                fontSize: '16px', 
                fill: '#fff',
                backgroundColor: '#000000',
                padding: { x: 15, y: 8 }
            }
        ).setOrigin(0.5)
         .setScrollFactor(0)
         .setDepth(20);

        // Stop all particle effects
        if (my.vfx.running) my.vfx.running.stop();
        if (my.vfx.jumping) my.vfx.jumping.stop();
        if (my.vfx.landing) my.vfx.landing.stop();
        if (my.vfx.wallSlide) my.vfx.wallSlide.stop();

        // Pause physics
        this.physics.pause();
        
        // Ensure player stays visible but can't move
        if (my.sprite.player) {
            my.sprite.player.setVelocity(0, 0);
        }
    }

    updateHealthDisplay() {
        // Clear existing hearts
        this.healthDisplay.clear(true, true);
        
        // Position for hearts
        const heartSize = 32;
        const padding = 5;
        const startX = 16;
        const startY = 60;

        // Create hearts based on current health
        for (let i = 0; i < this.PLAYER_CONFIG.currentHealth; i++) {
            const heart = this.add.image(
                startX + (heartSize + padding) * i,
                startY,
                'tilemap_sheet',
                151  // Using coin sprite temporarily - we should replace with heart sprite
            ).setScrollFactor(0)
             .setDepth(20)
             .setScale(0.75);
            
            this.healthDisplay.add(heart);
        }
    }

    damagePlayer() {
        // Apply damage
        this.PLAYER_CONFIG.currentHealth -= this.PLAYER_CONFIG.damageAmount;
        this.updateHealthBar();

        // Visual feedback
        my.sprite.player.setTint(0xff0000);
        this.cameras.main.shake(100, 0.01);

        // Check for game over
        if (this.PLAYER_CONFIG.currentHealth <= 0) {
            this.gameOver();
            return;
        }

        // Clear tint after brief flash
        this.time.delayedCall(100, () => {
            my.sprite.player.clearTint();
        });
    }

    gameOver() {
        // Stop physics and player movement
        this.physics.pause();
        my.sprite.player.setTint(0xff0000);

        // Create game over text
        const gameOverText = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            'GAME OVER\nPress R to restart',
            {
                fontSize: '32px',
                fill: '#fff',
                align: 'center',
                backgroundColor: '#000',
                padding: { x: 20, y: 10 }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(20);
    }

    setupEnemies() {
        // Define fixed enemy positions based on the level layout
        const enemyPositions = [
            { x: 400, y: 200 },  // First platform
            { x: 800, y: 300 },  // Middle area
            { x: 1200, y: 200 }  // Upper platform
        ];

        enemyPositions.forEach(pos => {
            const enemy = this.enemies.create(pos.x, pos.y, 'platformer_characters', 'tile_0024.png');
            
            // Set up enemy properties
            enemy.setCollideWorldBounds(true);
            enemy.setBounce(0);
            enemy.setDepth(3);
            enemy.setFriction(1000, 0);
            
            // Custom properties for patrol
            enemy.startX = pos.x;
            enemy.patrolDistance = this.ENEMY_CONFIG.patrol.patrolDistance;
            enemy.direction = 1;
            enemy.setVelocityX(this.ENEMY_CONFIG.patrol.speed);
        });
    }

    handleEnemyCollision(player, enemy) {
        this.damagePlayer();
    }

    createHealthBar() {
        const barConfig = {
            width: 50,  // Smaller width to fit above player
            height: 6,  // Thinner bar
            padding: 1,
            backgroundColor: 0x808080,
            fillColor: 0x00ff00
        };

        // Create container for health bar
        this.healthBar = this.add.group();

        // Background
        this.healthBarBg = this.add.rectangle(
            0, 0,  // Position will be updated in update()
            barConfig.width + barConfig.padding * 2,
            barConfig.height + barConfig.padding * 2,
            0x000000
        ).setOrigin(0.5, 1).setDepth(10);

        // Health fill
        this.healthBarFill = this.add.rectangle(
            0, 0,  // Position will be updated in update()
            barConfig.width,
            barConfig.height,
            barConfig.fillColor
        ).setOrigin(0.5, 1).setDepth(10);

        // Store initial width for calculations
        this.healthBarFill.maxWidth = barConfig.width;

        // Add to container
        this.healthBar.add(this.healthBarBg);
        this.healthBar.add(this.healthBarFill);
    }

    updateHealthBar() {
        // Update health bar position to follow player
        const yOffset = -10; // Distance above player
        this.healthBarBg.setPosition(my.sprite.player.x, my.sprite.player.y + yOffset);
        this.healthBarFill.setPosition(my.sprite.player.x, my.sprite.player.y + yOffset);
        
        // Update health bar fill
        const healthPercent = this.PLAYER_CONFIG.currentHealth / this.PLAYER_CONFIG.maxHealth;
        this.healthBarFill.width = this.healthBarFill.maxWidth * healthPercent;
    }
}
