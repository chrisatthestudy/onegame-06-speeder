var hyperspeeder = (function() {
        
    // Variables for THREE.js objects
    var container, controls, stats;
    var keyboard = new THREEx.KeyboardState();
    var clock = new THREE.Clock();
    var texture_placeholder;
    
    var game;
    var speeder;
    var model;
    var hud;
    var logo_img;
    var gameover_img;
    var level_img;
    var finish_img;
    var title;
    
    var target = 0;
    var jump = 0;
    var jumpStart = 0;
    var drop = 0;

    // Pseudo-constants (Careful - These are also defined in level.js!)
    var ACC = "^";
    var DEC = "V";
    var END = "=";
    var GAP = " ";
    
    /*
     * loadTexture()
     * Creates and returns a material from an external image file
     */
    //{{{
    function loadTexture( path ) {
    
        var texture = new THREE.Texture( texture_placeholder );
        var material = new THREE.MeshBasicMaterial( { map: texture, overdraw: true } );
    
        var image = new Image();
        image.onload = function () {
    
            texture.needsUpdate = true;
            material.map.image = this;
    
            render();
    
        };
        image.src = path;
    
        return material;
    
    };
    //}}}
    
    /*
     * =============================================================================
     * Power-up Indicator
     * =============================================================================
     * Power-ups are simple flat planes attached to the top of power-up blocks
     * (which are otherwise visually indistinguishable from other blocks).
     */
    //{{{
    var makePowerupIndicator = function(gameObject) {
        'use strict';
        
        // Actual object which will be returned
        var indicator = new THREE.Object3D();
        
        // -------------------------------------------------------------------------
        // Context
        // -------------------------------------------------------------------------
        // These variables are accessible to the trail object, but inaccessible to
        // any external functions or objects.
    
        // Store a reference to the main game instance.
        var game = gameObject;
    
        /*
         * init() - creates the actual indicator object
         */
        indicator.init = function(type) {
            var geometry = new THREE.PlaneGeometry(4, 4, 1, 1);
            if (type === ACC) {
                var material = loadTexture( "graphics/chevrons.png" );
            } else if (type === DEC) {
                var material = loadTexture( "graphics/brakes.png" );
            } else if (type == END) {
                var material = loadTexture( "graphics/finish.png" );
            }
            material.transparent = true;
            // material.opacity = 0.5;
            var mesh = new THREE.Mesh( geometry, material );
            mesh.rotation.x = 270 * Math.PI/180;
            indicator.add(mesh);
            //indicator.position.set(0, 42, 0);
        };
        return indicator;
    };
    //}}}
    
    /*
     * TrackMap
     * Object to handle the layout of the track, and in particular where the
     * power-ups and gaps in the track are.
     */
    //{{{
    // -----------------------------------------------------------------------------
    // Factory - makeTrack(gameObject)
    // -----------------------------------------------------------------------------
    // Returns a trackMap object. Each 'level' has its own map.
    // -----------------------------------------------------------------------------
    var makeTrackMap = function( gameObject ) {
        'use strict';
        
        // -------------------------------------------------------------------------
        // Context
        // -------------------------------------------------------------------------
        // These variables are accessible to the trackMap object, but inaccessible
        // to any external functions or objects.
        
        // Store a reference to the main game instance
        var game = gameObject;
        
        // Create and return the actual object
        return {
        
            // Array to hold the layout
            map: [],
            
            // Pointer to the current row in the array. The map array is an array of
            // arrays, and each inner array holds three values, one for each segment
            // of the track (from left to right).
            row: 0,
            
            // init - Initialises the track for the specified level.
            init: function(level) {
                // Load the map
                this.map = levelMap(level);
                // Reset the row position. This will be incremented to 0 (the first
                // valid position) on the first call to trackMap.next()
                this.row = -1;
            },
            
            // next - returns the next row segments from the map
            next: function() {
                this.row++;
                // Set up the array to return the row, with a default in case we have
                // run out of track.
                // TODO: default to empty segments for the final version
                var segments = ['.', '.', '.'];
                if (this.row < this.map.length) {
                    segments = this.map[this.row];
                } else {
                    this.row = -1;
                }
                return segments;
            },
                
            // reset - sets the track map pointer so that the next call to next()
            // will return the first row
            reset: function() {
                this.row = -1;
            },
            
            length: function() {
                return this.map.length;
            }
            
        };
    };
    
    //}}}
    
    /*
     * =============================================================================
     * Block
     * =============================================================================
     * Object to handle one block of the track
     */
    //{{{
    // Factory - makeBlock(gameObject)
    // Returns an initialised track block object
    var makeBlock = function(gameObject, geometry, material, blockType) {
        'use strict';
        
        // -------------------------------------------------------------------------
        // Context
        // -------------------------------------------------------------------------
        // These variables are accessible to the trail object, but inaccessible to
        // any external functions or objects.
    
        // Store a reference to the main game instance
        var game = gameObject;
        
        // Create and return the actual track block object
        return {
            // Base model
            model: null,
            // Power-up type
            type: blockType,
            // Power-up indicator (if required)
            indicator: null,
            // Block position (valid even if there is no actual block model)
            position: new THREE.Vector3(0, 0, 0),
            // Initialisation function to place the block and create the power-up
            // indicator if required
            init: function( x, y, z ) {
                if ( this.type !== " " ) {
                    this.model = new THREE.Mesh( geometry, material );
                    this.model.scale.set(10, 5, 10);
                    this.model.position.x = x;
                    this.model.position.y = y;
                    this.model.position.z = z;
                    this.position.x = this.model.position.x;
                    this.position.y = this.model.position.y;
                    this.position.z = this.model.position.z;
                
                    if ( ( this.type === ACC ) || ( this.type === DEC ) || ( this.type === END ) ) {
                        this.indicator = makePowerupIndicator( game );
                        this.indicator.init(this.type);
                        this.indicator.position.set( 0, 1.05, 0 );
                        this.model.add( this.indicator );
                    }
                    game.scene.add(this.model);
                } else {
                    this.position.x = x;
                    this.position.y = y;
                    this.position.z = z;
                }
            },
            // Move the block. Track blocks only ever move along the z-axis.
            move: function( moveBy ) {
                this.moveTo( this.position.z + moveBy );
            },
            moveTo: function( new_z ) {
                this.position.z = new_z;
                if (this.model) {
                    this.model.position.z = this.position.z;
                }
            },
            clear: function() {
                if (this.model) {
                    game.scene.remove(this.model);
                }
            }
        };
    };
    //}}}
    
    /*
     * =============================================================================
     * Track
     * =============================================================================
     * Object to handle the main track
     */
    //{{{ 
    // -----------------------------------------------------------------------------
    // Factory - makeTrack(gameObject)
    // -----------------------------------------------------------------------------
    // Returns an initialised track object
    var makeTrack = function(gameObject) {
        'use strict';
    
        // Actual track object which will be returned
        var track = { };
        track.isActive = false;
        
        // -------------------------------------------------------------------------
        // Context
        // -------------------------------------------------------------------------
        // These variables are accessible to the trail object, but inaccessible to
        // any external functions or objects.
    
        // Store a reference to the main game instance.
        var game = gameObject;
    
        // Array of current blocks
        var blockList = [];
    
        // Geometry and materials for the blocks
        var plainBlockMaterial = null;
        var plainBlockGeometry = null;
        
        // Powerup indicator
        var indicator = null;
    
        // Track Map
        var trackMap = null;
        
        var speed = 2;
        
        // -------------------------------------------------------------------------
        // Methods
        // -------------------------------------------------------------------------
    
        /*
         * onJSONLoad()    
         * Callback for JSON load routine
         */
        track.onJSONLoad = function(geometry, materials) {
            plainBlockMaterial = materials[0];
            plainBlockGeometry = geometry;
            
            var indicator;
            
            track.clear();
            blockList = [];
            
            trackMap = makeTrackMap(track.game);
            trackMap.init(game.level);
            
            // Track map segments (array of left, middle, right)
            var segments;

            var block;
            for (var i = 0; i < trackMap.length(); i++)
            {
                var blocks = [];
                var x = -40;
                
                // Get the track row
                segments = trackMap.next();
                
                // The track is in three segments -- left, middle, and right
                for (var j = 0; j < 3; j++)
                {
                    block = makeBlock( game, plainBlockGeometry, plainBlockMaterial, segments[j]);
                    block.init(x, -10.0, i * -40);
                    blocks.push(block);
                    x = x + 40;
                }
    
                blockList.push(blocks);
            }
            // Reset the track map position
            trackMap.reset();
            track.isActive = true;
            speed = 2;
        };
        
        /*
         * load()
         * Loads the block models and textures, using the onJSONLoad callback to
         * then create the initial track
         */
        track.load = function() {
            track.isActive = false;
            var jsonLoader = new THREE.JSONLoader();
            jsonLoader.load( "models/track.js", track.onJSONLoad );
        };
        
        /*
         * update()
         * Scrolls the track
         */
        track.update = function(delta, speederPosition) {
            // Scroll the track elements. Once they go behind the speeder, move them
            // to the distant 'front' of the track.
            var newZ = 0;
            var newBlocksRequired = false;
            for (var i = 0; i < blockList.length; i++) 
            {
                if (blockList[i][0]) {
                    newZ = blockList[i][0].position.z + speed;
                    if (newZ >= (40 * 3))
                    {
                        newBlocksRequired = true;
                    }
                    blockList[i][0].moveTo( newZ );
                }
                if (blockList[i][1]) {
                    newZ = blockList[i][1].position.z + speed;
                    blockList[i][1].moveTo( newZ );
                }
                if (blockList[i][2]) {
                    newZ = blockList[i][2].position.z + speed;
                    blockList[i][2].moveTo( newZ );
                }
            }
            if (newBlocksRequired)
            {
                // Remove the blocks from the beginning of the track
                var oldBlocks = blockList.shift();
                game.scene.remove(oldBlocks[0]);
                game.scene.remove(oldBlocks[1]);
                game.scene.remove(oldBlocks[2]);
                
                newZ = ((blockList.length - 3) * -40) + speed;
                
                // Create three new blocks
                var blocks = [];
                var block = null;
                var x = -40;
                for (var j = 0; j < 3; j++)
                {
                    block = makeBlock( game, plainBlockGeometry, plainBlockMaterial, ".");
                    block.init(x, -10.0, newZ);
                    blocks.push(block);
                    x = x + 40;
                }
                
                // Push the new blocks to the end of the track
                blockList.push(blocks);
                
                // Check which block type the speeder is over
                var blockType = track.segmentAt(game.speeder.position().x, game.speeder.position().y);
                if ((blockType === ACC) && (jump === 0) && (speed < 8)) {
                    speed = speed + 2;
                } else if ((blockType === DEC) && (jump === 0) && (speed > 2)) {
                    speed = speed - 2;
                } else if ((blockType === END) && (!game.isOver)) {
                    game.levelComplete();
                }
                
                game.speeder.blockType = blockType;
            }
        };
        
        // Returns the character which indicates the type of the track which is at
        // the specified position
        track.segmentAt = function(x, y) {
            var block;
            var segment = '.';
            for (var j = 0; j < 3; j++) {
                block = blockList[2][j];
                if (((block.position.x - 20) < x) && ((block.position.x + 20) > x)) {
                    segment = block.type;
                }
            }
            return segment;
        };
        
        track.get_speed = function() {
            return speed;
        };
        
        track.clear = function() {
            var block = null;
            for (var i = 0; i < blockList.length; i++) {
                for (var j = 0; j < 3; j++) {
                    block = blockList[i][j];
                    block.clear();
                }
            }
            blockList = [];
        };
        
        // Return the initialised track object
        return track;
    }
    //}}}
    
    /*
     * =============================================================================
     * Trail
     * =============================================================================
     * Object to handle the jet-trail
     */
    //{{{ 
    var makeTrail = function(gameObject, options) {
        'use strict';
    
        // Actual trail object which will be returned
        var trail = new THREE.Object3D();
        
        // -------------------------------------------------------------------------
        // Context
        // -------------------------------------------------------------------------
        // These variables are accessible to the trail object, but inaccessible to
        // any external functions or objects.
        
        // Reference to the main game object
        var game = gameObject;
        
        // Options for the trail
        var x = options.x || 0;
        var y = options.y || 10;
        var z = options.z || 50;
        
        // -------------------------------------------------------------------------
        // Methods
        // -------------------------------------------------------------------------
        
        /*
         * init() - initialises the trail, creating the objects that make it up,
         *          and positioning them.
         */
        trail.init = function() {
            trail.position.set(x, y, z);
            // Set up the geometry and material for the pulses
            var geometry = new THREE.CircleGeometry(2, 16);
            var material = loadTexture( "graphics/trail.png" );
            material.transparent = true;
            material.opacity = 0.5;
            var pulse = null;
            // Create the individual pulses
            for (var i = 0; i < 20; i++) {
                pulse = new THREE.Mesh( geometry, material);
                pulse.position.set(0, 0, i);
                pulse.scale.set(1 - i/20, 1 - i/20, 1);
                trail.add(pulse);
            }
        };
        
        /*
         * moveTo(x, y, z) - moves the trail to a new location
         */
        trail.moveTo = function(new_x, new_y, new_z) {
            x = new_x;
            y = new_y;
            z = new_z;
            trail.position.set(x, y, z);
        };
        
        /*
         * update(delta) - updates the trail ready for the next frame
         */
        trail.update = function(delta) {
            var pulse;
            var new_z = 0;
            var angle = 360 / trail.children.length;
            for (var i = 0; i < trail.children.length; i++) {
                pulse = trail.children[i];
                new_z = pulse.position.z + 0.1 + (Math.random() / 10);
                if (new_z > 20) {
                    new_z = 0;
                }
                pulse.position.set(pulse.position.x, pulse.position.y, new_z);
                pulse.rotation.z = (angle * pulse.position.z) * Math.PI/180;
                pulse.scale.set(1 - new_z/20, 1 - new_z/20, 1);
            }
        };
        
        return trail;    
    };
    //}}}
    
    /*
     * =============================================================================
     * Speeder
     * =============================================================================
     * Object to handle the HyperSpeeder
     */
    //{{{
    var makeSpeeder = function(gameObject) {
        'use strict';
    
        // Actual speeder object which will be returned
        var speeder = { };
        speeder.isActive = false;
    
        // -------------------------------------------------------------------------
        // Context
        // -------------------------------------------------------------------------
        // These variables are accessible to the trail object, but inaccessible to
        // any external functions or objects.
    
        // Store a reference to the main game instance.
        speeder.game = gameObject;
    
        // Flag to indicate that the asyncronous loading the model is complete
        var modelLoaded;
        speeder.modelLoaded = false;
        
        // Jet trails
        var jet_trails;
        var left_trail;
        var mid_trail;
        var right_trail;
        
        // Thrusters control left and right movement
        speeder.thrustLeft = 0;
        speeder.thrustRight = 0;

        // The block type that the speeder is over
        speeder.blockType = null;
    
        // Main model
        speeder.speederModel = null;
    
        // Shadow beneath the speeder
        speeder.speederShadow = null;
        
        // Target for the camera
        speeder.camTarget = new THREE.Vector3(0, 0, 0),
    
        // -------------------------------------------------------------------------
        // Methods
        // -------------------------------------------------------------------------
        
        speeder.init = function()
        {
            'use strict';
            
            speeder.isActive = false;
            speeder.loadSpeederModel();
            
            var shadowGeometry = new THREE.PlaneGeometry(30, 40, 1, 1)
            var shadowMaterial = loadTexture( "models/shadow.png" );
            shadowMaterial.transparent = true;
            speeder.speederShadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
            speeder.speederShadow.rotation.x = 270 * Math.PI/180;
            speeder.speederShadow.position.set(0, 2, 0);
            speeder.camTarget.copy(speeder.speederShadow.position);
            this.game.scene.add(speeder.speederShadow);
            
        };
        
        speeder.loadSpeederModel = function()
        {
            var jsonLoader = new THREE.JSONLoader();
            jsonLoader.load( "models/speeder2.js", function( geometry, materials ) {
                var material = materials[0];
                material.specular = new THREE.Color( 0xffffff );
                var innerModel = new THREE.Mesh( geometry, material );
                innerModel.rotation.y = 90 * Math.PI/180;
                speeder.speederModel = new THREE.Object3D();
                speeder.speederModel.add(innerModel);
                speeder.speederModel.scale.set(5,5,5);
                speeder.speederModel.position.set(0, 10, 0);
                
                jet_trails = new THREE.Object3D();
                jet_trails.scale.set(0.2, 0.2, 0.2);
                
                left_trail = makeTrail(speeder.game, { x: -10, y: -2.5, z: 12 });
                left_trail.init();
                jet_trails.add(left_trail);
        
                mid_trail = makeTrail(speeder.game, { z: 12, y: -0.5 });
                mid_trail.init();
                jet_trails.add(mid_trail);
        
                right_trail = makeTrail(speeder.game, { x: 10, y: -2.5, z: 12 });
                right_trail.init();
                jet_trails.add(right_trail);
    
                speeder.speederModel.add( jet_trails );
                speeder.game.scene.add( speeder.speederModel );
                speeder.modelLoaded = true;
                modelLoaded = true;
            });
        };
        
        speeder.update = function()
        {
            'use strict';
            var camTarget;
            if (modelLoaded)
            {
                /*
                if ( keyboard.pressed("space") )
                {
                    game.isPaused = true;
                }
                else
                {
                    game.isPaused = false;
                }
                */
                
                if ( keyboard.pressed("enter") )
                {
                    if (this.game.isOver) {
                        game.levelComplete();
                        // Restart by reloading the page (crude, but works for now)
                        // window.location.replace(window.location.pathname);
                    } else {
                        logo_img.className = "hidden";
                        level_img.className = "hidden";
                        gameover_img.className = "hidden";
                        finish_img.className = "hidden";
                        title.innerHTML = "&nbsp;Attempt " + this.game.attempts + " Level " + this.game.level;
                        title.className = "visible";
                        this.isActive = true;
                    }
                }
                
                if ((!game.isPaused) && (game.track.isActive))
                {
                    if ( keyboard.pressed("left") )
                    {
                        speeder.thrustRight = 0;
                        speeder.thrustLeft = speeder.thrustLeft + 1;
                        if ((speeder.speederModel.position.x - speeder.thrustLeft) > -37) {
                            target = speeder.speederModel.position.x - speeder.thrustLeft;
                        } else {
                            target = -37;
                        }
                    } else if (speeder.thrustLeft > 0) {
                        speeder.thrustLeft = speeder.thrustLeft - 2;
                        if ((speeder.speederModel.position.x - speeder.thrustLeft) > -37) {
                            target = speeder.speederModel.position.x - speeder.thrustLeft;
                        }
                    } else {
                        speeder.thrustLeft = 0;
                    }
                        
                    
                    if ( keyboard.pressed("right") )
                    {   
                        speeder.thrustLeft = 0;
                        speeder.thrustRight = speeder.thrustRight + 1;
                        if ((speeder.speederModel.position.x + speeder.thrustRight) < 37) {
                            target = speeder.speederModel.position.x + speeder.thrustRight;
                        } else {
                            target = 37;
                        }
                    } else if (speeder.thrustRight > 0) {
                        speeder.thrustRight = speeder.thrustRight - 2;
                        if ((speeder.speederModel.position.x + speeder.thrustRight) < 37) {
                            target = speeder.speederModel.position.x + speeder.thrustRight;
                        }
                    } else {
                        speeder.thrustRight = 0;
                    }
                    
                    if ( keyboard.pressed("up") && (jump === 0) && (drop === 0) )
                    {
                        jump = 1;
                        jumpStart = Date.now();
                    }
                    
                    if (speeder.speederModel.position.x != target)
                    {
                        var newX = speeder.speederModel.position.x;
                        if (newX > target)
                        {
                            newX = newX - 1;
                            if (speeder.speederModel.rotation.z < (10 * Math.PI/180)) {
                                speeder.speederModel.rotation.z += 1 * Math.PI/180;
                            }
                        }
                        else if (newX < target)
                        {
                            newX = newX + 1;
                            if (speeder.speederModel.rotation.z > (-10 * Math.PI/180)) {
                                speeder.speederModel.rotation.z -= 1 * Math.PI/180;
                            }
                        }
                        speeder.speederModel.position.x = newX;
                        speeder.speederShadow.position.x = newX;
                    }
                    else
                    {
                        if (speeder.speederModel.rotation.z < -0.1) {
                            speeder.speederModel.rotation.z += 2 * Math.PI/180;
                        } else if (speeder.speederModel.rotation.z > 0.1) {
                            speeder.speederModel.rotation.z -= 2 * Math.PI/180;
                        } else {
                            speeder.speederModel.rotation.z = 0;
                        }
                    }
                    
                    if ( jump !== 0 )
                    {
                        var gap = Date.now() - jumpStart;
                        var adjust = Math.sin(gap / 250);
                        var newY = adjust * 20;
                        if ( newY < 0 )
                        {
                            newY = 0;
                            jump = 0;
                        }
                        speeder.speederModel.position.y = 10 + newY;
                        speeder.speederShadow.position.y = 2;
                        adjust = Math.sin(gap / 250) / 5.0;
                        speeder.speederShadow.scale.set(1 - adjust, 1 - adjust, 1 - adjust);
                    } 
                    else if (drop === 0)
                    {
                        var gap = Date.now() - jumpStart;
                        var adjust = Math.sin(gap / 80);
                        var newY = adjust / 5.0;
                        speeder.speederModel.position.y = 10 + newY;
                        speeder.speederShadow.position.y = 2;
                        speeder.speederShadow.scale.set(1 - adjust / 100, 1 - adjust / 100, 1 - adjust / 100);
                    }
                    
                    if ((speeder.blockType === GAP) && (speeder.speederModel.position.y <= 10))
                    {
                        drop = 10;
                        speeder.speederModel.position.y = speeder.speederModel.position.y - drop;
                        speeder.speederShadow.position.y = speeder.speederShadow.position.y - drop;
                        this.game.camera.position.y = speeder.speederModel.position.y + 45;
                    }
                    
                    // The camera target is kept roughly in sync with the
                    // shadow position, but adjusted so that it is offset
                    // towards the centre of the screen.
                    speeder.camTarget.copy(speeder.speederShadow.position);
                    speeder.camTarget.x = speeder.camTarget.x / 2;
                }
                
                left_trail.update();
                mid_trail.update();
                right_trail.update();
                
                this.game.camera.lookAt(speeder.camTarget);
            }    
        };
        
        speeder.position = function() {
            if (speeder.speederModel) {
                return speeder.speederModel.position;
            } else {
                return new THREE.Vector3(0, 0, 0);
            }
        };
        
        // Return the initialised object
        return speeder;
    };
    //}}}

    /*
     * =============================================================================
     * game
     * =============================================================================
     * Main game controller object (Singleton)
     */
    //{{{
    var game = (function() 
    {
        return {
            // Components
            scene: null,
            camera: null,
            renderer: null,
            speeder: null,
            track: null,
            // Game State (these are not mutually exclusive)
            isPaused: false,
            isOver: false,
            // Current level
            level: 1,
            attempts: 1,
            // Methods
            // init() : sets up the game, creating all the required objects
            init: function() {
                'use strict';
                
                this.gameTrack = new Audio("sounds/DST-AngryMod.ogg");
                this.gameTrack.addEventListener("ended", function() {
                    this.currentTime = 0;
                    this.play();
                }, false);
                this.gameTrack.play();
                
                // Create the scene controller
                this.scene = new THREE.Scene();
                
                // Set the view size
                var SCREEN_WIDTH = 600, SCREEN_HEIGHT = 600;
                //var SCREEN_WIDTH = window.innerWidth, SCREEN_HEIGHT = window.innerHeight;
                
                // Set up the camera attributes and create the camera
                var VIEW_ANGLE = 45, ASPECT = SCREEN_WIDTH / SCREEN_HEIGHT, NEAR = 0.1, FAR = 20000;
                this.camera = new THREE.PerspectiveCamera( VIEW_ANGLE, ASPECT, NEAR, FAR );
                
                // Attach the camera to the scene
                this.scene.add(this.camera);
                
                // The camera defaults to position (0,0,0) so re-position it
                this.camera.position.set(0,45,100);
                
                // create and start the renderer; choose antialias setting.
                if ( Detector.webgl )
                    this.renderer = new THREE.WebGLRenderer( {antialias:true, canvas: document.getElementById('canvas')} );
                else
                    this.renderer = new THREE.CanvasRenderer(); 
                
                this.renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
                
                container = document.getElementById( 'container' );
                // attach renderer to the container div
                // container.appendChild( this.renderer.domElement );
                
                // automatically resize renderer
                THREEx.WindowResize(this.renderer, this.camera);
            
                this.speeder = makeSpeeder(game);
                this.speeder.init();
                
                this.track = makeTrack(game);
                this.track.load();
                
            },
            levelComplete: function() {
                'use strict';
                title.className = "hidden";
                if (this.isOver) {
                    this.isOver = false;
                    this.attempts = this.attempts + 1;
                } else if (this.level === 4) {
                    finish_img.className = "visible",
                    this.attempts = 1;
                    this.level = 1;
                } else {
                    level_img.className = "visible";
                    this.level = this.level + 1;
                }
                drop = 0;
                jump = 0;
                this.camera.position.set(0,45,100);
                this.speeder.blockType = '.';
                this.speeder.speederModel.position.y = 10;
                this.speeder.speederShadow.position.y = 2;
                this.speeder.isActive = false;
                this.track.load();
            }
        };
    }());
    //}}}
    
    function init() 
    {
        game.init();
    
        // toggle full-screen on given key press
        // THREEx.FullScreen.bindKey({ charCode : 'm'.charCodeAt(0) });
        
        // move mouse and: left   click (or hold 'A') to rotate, 
        //                 middle click (or hold 'S') to zoom, 
        //                 right  click (or hold 'D') to pan
        // controls = new THREE.TrackballControls( game.camera );
        
        // displays current and past frames per second attained by scene
        /*
        stats = new Stats();
        stats.domElement.style.position = 'absolute';
        stats.domElement.style.bottom = '20px';
        stats.domElement.style.zIndex = 100;
        container.appendChild( stats.domElement );
        */
        
        hud = document.getElementById( "hud" );
        logo_img = document.getElementById( "logo" );
        level_img = document.getElementById( "level" );
        gameover_img = document.getElementById( "gameover" );
        finish_img = document.getElementById( "finish" );
        title = document.getElementById( "title" );
        logo_img.className = "visible";
        level_img.className = "hidden";
        gameover_img.className = "hidden";
        finish_img.className = "hidden";
        title.className = "hidden";
    
        // create a light
        var light = new THREE.PointLight(0xffffff);
        light.position.set(0, 250, 0);
        game.scene.add(light);
        var ambientLight = new THREE.AmbientLight(0xaaaaaa);
        game.scene.add(ambientLight);
        
        var materials = [
            loadTexture( 'graphics/skybox/left.bmp' ), // right
            loadTexture( 'graphics/skybox/right.bmp' ), // left
            loadTexture( 'graphics/skybox/top.bmp' ), // top
            loadTexture( 'graphics/skybox/bottom.bmp' ), // bottom
            loadTexture( 'graphics/skybox/back.bmp' ), // back
            loadTexture( 'graphics/skybox/front.bmp' )  // front
        ];
    
        skybox = new THREE.Mesh( new THREE.CubeGeometry( 10000, 10000, 10000, 7, 7, 7 ), new THREE.MeshFaceMaterial( materials ) );
        skybox.scale.x = - 1;
        game.scene.add( skybox );
    
    }
    
    function animate() 
    {
        requestAnimationFrame( animate );
        render();       
        update();
    }
    
    function update()
    {
        // delta = change in time since last call (in seconds)
        var delta = clock.getDelta(); 
    
        if ((!game.isPaused) && game.track.isActive && game.speeder.isActive && (game.speeder.position().y > (-60 * game.track.get_speed()))) {
            game.track.update(delta, game.speeder.position());
        }
        
        if (game.track.isActive && game.speeder.isActive && (game.speeder.position().y < 0)) {
            game.isOver = true;
            title.className = "hidden";
            gameover_img.className = "visible";
        }
    
        // controls.update();
        game.speeder.update();
        // stats.update();
        
    }
    
    function consoleMsg(msg) {
        output = "<p>Hyperspeeder console (press SHIFT + C to hide)</p>";
        output += "<p>" + msg + "</p>";
        hud.innerHTML = output;
    }
    
    function render() 
    {   
        game.renderer.render( game.scene, game.camera );
    }

    // Initialise the game...
    init();
    
    // ...and start it running
    animate();
    
}());
