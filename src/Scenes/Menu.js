class Menu extends Phaser.Scene {
    constructor() {
        super("menuScene");
    }

    create() {
        // Set up background
        this.add.rectangle(0, 0, game.config.width, game.config.height, 0x000033)
            .setOrigin(0);

        // Add magical particles in the background
        this.magicParticles = this.add.particles(0, 0, "kenny-particles", {
            frame: ['circle_05.png'],
            x: { min: 0, max: game.config.width },
            y: { min: 0, max: game.config.height },
            quantity: 2,
            frequency: 500,
            lifespan: 4000,
            alpha: { start: 0.5, end: 0 },
            scale: { start: 0.2, end: 0 },
            speed: { min: 20, max: 50 },
            angle: { min: 0, max: 360 },
            blendMode: 'ADD'
        });

        // Add title text with glow effect
        const titleText = this.add.text(
            game.config.width / 2,
            game.config.height / 3,
            'Magical Coin Quest',
            {
                fontSize: '64px',
                fill: '#fff',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);

        // Add glow effect to title
        this.tweens.add({
            targets: titleText,
            alpha: 0.7,
            yoyo: true,
            repeat: -1,
            duration: 1500,
            ease: 'Sine.easeInOut'
        });

        // Add story text
        const storyText = this.add.text(
            game.config.width / 2,
            game.config.height / 2,
            'The kingdom needs your help!\nCollect all the magical coins to restore balance.',
            {
                fontSize: '24px',
                fill: '#fff',
                align: 'center'
            }
        ).setOrigin(0.5);

        // Create play button with better visuals
        const playButton = this.add.rectangle(
            game.config.width / 2,
            game.config.height * 0.7,
            200,
            60,
            0x00aa00
        ).setInteractive();

        // Add button glow effect
        const buttonGlow = this.add.rectangle(
            game.config.width / 2,
            game.config.height * 0.7,
            210,
            70,
            0x00ff00,
            0.2
        );

        const playText = this.add.text(
            game.config.width / 2,
            game.config.height * 0.7,
            'PLAY',
            {
                fontSize: '32px',
                fill: '#fff'
            }
        ).setOrigin(0.5);

        // Add hover effect with sound
        playButton.on('pointerover', () => {
            playButton.setFillStyle(0x00cc00);
            buttonGlow.setAlpha(0.4);
            this.sound.play('buttonHover', { volume: 0.2 });
            this.tweens.add({
                targets: [playButton, playText],
                scale: 1.1,
                duration: 100
            });
        });

        playButton.on('pointerout', () => {
            playButton.setFillStyle(0x00aa00);
            buttonGlow.setAlpha(0.2);
            this.tweens.add({
                targets: [playButton, playText],
                scale: 1,
                duration: 100
            });
        });

        // Add click handler with sound
        playButton.on('pointerdown', () => {
            this.sound.play('buttonClick', { volume: 0.3 });
            this.cameras.main.fade(500, 0, 0, 0);
            this.time.delayedCall(500, () => {
                this.scene.start('platformerScene');
            });
        });
    }
} 