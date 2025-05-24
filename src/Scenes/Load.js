class Load extends Phaser.Scene {
    constructor() {
        super("loadScene");
    }

    preload() {
        this.load.setPath("./assets/");

        // Load characters spritesheet
        this.load.atlas("platformer_characters", "tilemap-characters-packed.png", "tilemap-characters-packed.json");

        // Load tilemap information
        this.load.image("tilemap_tiles", "tilemap_packed.png");                         // Packed tilemap
        this.load.image("background_tiles", "tilemap-backgrounds_packed.png");          // Background tileset
        this.load.tilemapTiledJSON("platformer-level-1", "platformer-level-1.tmj");   // Tilemap in JSON

        // Load the tilemap as a spritesheet
        this.load.spritesheet("tilemap_sheet", "tilemap_packed.png", {
            frameWidth: 18,
            frameHeight: 18
        });

        // Load particles
        this.load.multiatlas("kenny-particles", "kenny-particles.json");

        // Load Audio from Kenney's RPG Audio Pack (Sound Effects Only)
        this.load.audio('jumpSound', 'audio/kenney_rpg-audio/Audio/cloth1.ogg');
        this.load.audio('landSound', 'audio/kenney_rpg-audio/Audio/footstep01.ogg');
        this.load.audio('coinSound', 'audio/kenney_rpg-audio/Audio/handleCoins2.ogg');
        this.load.audio('buttonHover', 'audio/kenney_rpg-audio/Audio/metalClick.ogg');
        this.load.audio('buttonClick', 'audio/kenney_rpg-audio/Audio/handleCoins.ogg');
        this.load.audio('victorySound', 'audio/kenney_rpg-audio/Audio/handleCoins.ogg');

        // Add loading progress debug
        this.load.on('progress', function (value) {
            console.log('Loading: ' + Math.round(value * 100) + '%');
        });
        
        this.load.on('complete', function () {
            console.log('All assets loaded');
        });

        this.load.on('loaderror', function (file) {
            console.error('Error loading asset:', file.src);
        });
    }

    create() {
        console.log('Creating animations...');
        // Create animations
        this.anims.create({
            key: 'walk',
            frames: this.anims.generateFrameNames('platformer_characters', {
                prefix: "tile_",
                start: 0,
                end: 1,
                suffix: ".png",
                zeroPad: 4
            }),
            frameRate: 15,
            repeat: -1
        });

        this.anims.create({
            key: 'idle',
            defaultTextureKey: "platformer_characters",
            frames: [
                { frame: "tile_0000.png" }
            ],
            repeat: -1
        });

        this.anims.create({
            key: 'jump',
            defaultTextureKey: "platformer_characters",
            frames: [
                { frame: "tile_0001.png" }
            ],
        });

        console.log('Starting menu scene...');
        // Start with the menu scene
        this.scene.start("menuScene");
    }

    // Never get here since a new scene is started in create()
    update() {
    }
}