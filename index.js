(async () => {
			const response = await fetch('game-data.json');
			const gameData = await response.json();

			if (!response.ok) {
				console.error("Nelze načíst game-data.json:", response.status);
			}

			// Načítání všech code souborů do dictionary
			const codeFiles = {};
			
			async function loadAllCodeFiles() {
				try {
					// Zkusíme načíst manifest soubor s názvy code souborů
					try {
						const manifestResponse = await fetch('codes-manifest.json');
						if (manifestResponse.ok) {
							const manifest = await manifestResponse.json();
							console.log('Loading codes from manifest:', manifest);
							
							for (const codeFileName of manifest.files || []) {
								try {
									const fileResponse = await fetch(codeFileName);
									if (fileResponse.ok) {
										const fileData = await fileResponse.json();
										const codeKey = codeFileName.replace('.code', '');
										codeFiles[codeKey] = fileData.code || '';
										console.log(`Loaded code file: ${codeKey}`);
									}
								} catch (error) {
									console.warn(`Failed to load ${codeFileName}:`, error);
								}
							}
							return;
						}
					} catch (manifestError) {
						console.log('No codes-manifest.json found, trying directory listing...');
					}

					// Fallback: zkusíme directory listing
					const codesResponse = await fetch('./');
					if (codesResponse.ok) {
						const codesHtml = await codesResponse.text();
						console.log('Directory listing response length:', codesHtml.length);
						
						// Najdeme všechny odkazy na .code soubory
						const codeFileMatches = codesHtml.match(/href="([^"]*\.code)"/g);
						console.log('Found .code file matches:', codeFileMatches);
						
						if (codeFileMatches) {
							for (const match of codeFileMatches) {
								const fileName = match.match(/href="([^"]*)"/)[1];
								console.log(`Attempting to load: ${fileName}`);
								
								try {
									const fileResponse = await fetch(fileName);
									if (fileResponse.ok) {
										const fileData = await fileResponse.json();
										const codeKey = fileName.replace('.code', '');
										codeFiles[codeKey] = fileData.code || '';
										console.log(`Loaded code file: ${codeKey}`);
									} else {
										console.warn(`Failed to fetch ${fileName}: ${fileResponse.status}`);
									}
								} catch (error) {
									console.warn(`Failed to load ${fileName}:`, error);
								}
							}
						} else {
							console.warn('No .code files found in directory listing');
						}
					} else {
						console.warn('Failed to fetch directory listing:', codesResponse.status);
					}
				} catch (error) {
					console.warn('Could not load codes directory:', error);
				}
			}

			

			// Načteme všechny code soubory před spuštěním hry
			await loadAllCodeFiles();
			function requestFullscreen() {
			const elem = document.documentElement; // nebo třeba canvas
			if (elem.requestFullscreen) {
				elem.requestFullscreen();
			} else if (elem.webkitRequestFullscreen) {
				elem.webkitRequestFullscreen();
			} else if (elem.msRequestFullscreen) {
				elem.msRequestFullscreen();
			}
		}

		document.getElementById("fullscreenBtn").addEventListener("click", () => {
			requestFullscreen();
		});

			const canvas = document.getElementById('game');
			canvas.width = gameData.screen.width;
			canvas.height = gameData.screen.height;
			const ctx = canvas.getContext('2d');

			const GAME_WIDTH = gameData.screen.width;
			const GAME_HEIGHT = gameData.screen.height;

			function resizeCanvas() {
				const scaleX = window.innerWidth / GAME_WIDTH;
				const scaleY = window.innerHeight / GAME_HEIGHT;
				const scale = Math.min(scaleX, scaleY); // zachová poměr

				canvas.style.width = (GAME_WIDTH * scale) + "px";
				canvas.style.height = (GAME_HEIGHT * scale) + "px";
			}

			window.addEventListener("resize", resizeCanvas);
			resizeCanvas();

			const images = {};
			const input = {
				keydown: {},
				keyup: {},
				mousedown: {},
				mouseup: {},
				justPressed: {},
				justReleased: {}
			};

			const camera = {
				x: 0,
				y: 0
			};

			const spritesById = {};

			// Inicializace sprite objektů
			function initSpriteData(sprite) {
				const init_data = sprite
				spritesById[sprite.id] = sprite;
				sprite.vx = 0;
				sprite.vy = 0;
				sprite.gravity = 0; // default gravitace 0
				sprite.opacity = init_data.opacity;
				sprite.layer = init_data.layer;
				sprite.direction = 0

				sprite.uiText = ""; // výchozí žádný text
				sprite.uiTextColor = "white";
				sprite.uiTextSize = 14;
				sprite.uiTextAlign = "center";
				sprite.uiTextFont = "sans-serif"
			}

			// Načtení obrázků
			function loadAllSpriteTextures() {
			Promise.all(gameData.sprites.map(sprite => new Promise(resolve => {
				const img = new Image();
				img.src = sprite.texture;
				img.onload = () => { images[sprite.id] = img; resolve(); };
				img.onerror = () => { 
					console.warn(`Nelze načíst texturu ${sprite.texture}`); 
					resolve(); 
				};
			})));
			}

			function loadImageFromData(spriteData) {
				if (!spriteData || !spriteData.id || !spriteData.texture) {
					console.warn('Neplatná data sprite (chybí id nebo texture).');
					return Promise.resolve();
				}

				return new Promise(resolve => {
					const img = new Image();
					img.src = spriteData.texture;
					img.onload = () => {
						images[spriteData.id] = img;
						resolve();
					};
					img.onerror = () => {
						console.warn(`Nelze načíst texturu ${spriteData.texture}`);
						resolve();
					};
				});
			}

			function generateUUID() {
				return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
					const r = Math.random() * 16 | 0; 
					const v = c === 'x' ? r : (r & 0x3 | 0x8);
					return v.toString(16);
				});
			}
			// Zpracování skriptů - vytvoření funkcí onStart, onUpdate, onKey, onClick //for (const sprite of gameData.sprites)
			function attachSpriteHandlers(sprite) {
				try {
			const f = new Function('self', 'sprites', 'input', 'camera', sprite.script);
			const scriptObj = {};
			f.call(scriptObj, scriptObj, spritesById, input, camera);
			//basic custum functions
			sprite.onStart = scriptObj.onStart || (() => {});
			sprite.onUpdate = scriptObj.onUpdate || (() => {});
			
			sprite.onClick = scriptObj.onClick || null;
			sprite.onRightClick = scriptObj.onRightClick || null;
			

			sprite.gravity = scriptObj.gravity !== undefined ? scriptObj.gravity : 0;

			sprite.setTexture = function(newTexture) {
			this.texture = newTexture;
			const img = new Image();
			img.src = newTexture;
			img.onload = () => {
				images[this.id] = img;
				};
				img.onerror = () => {
					console.warn(`Nelze načíst texturu ${newTexture}`);
				};
			};

			sprite.getRandomInt = function(min, max) {
				const minCeiled = Math.ceil(min);
				const maxFloored = Math.floor(max);
				return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled);
			}

			sprite.setLayer = function(layer) {
				this.layer = layer
			}

			sprite.setOpacity = function(opacity) {
				this.opacity = opacity
			}

			sprite._sounds = {};

			sprite.playSound = function(name) {
				if (!this._sounds[name]) {
					this._sounds[name] = new Audio(name);
				}
				this._sounds[name].currentTime = 0;
				this._sounds[name].play().catch(e => console.warn("Chyba přehrávání:", e));
			};

			sprite.stopSound = function(name) {
				if (this._sounds[name]) {
					this._sounds[name].pause();
					this._sounds[name].currentTime = 0;
				}
			};

			sprite.stopAllSounds = function() {
				for (const snd in this._sounds) {
					this._sounds[snd].pause();
					this._sounds[snd].currentTime = 0;
				}
			};
			//here add other functions
			
			// Jednoduchá funkce pro získání kódu z předem načtených souborů
			sprite.fetchCodeReference = function(codeFileName) {
				// Odstraní .code příponu pokud je zadána
				const codeKey = codeFileName.replace(/\.code$/, '').replace(/^codes\//, '');
				
				if (codeFiles[codeKey]) {
					return codeFiles[codeKey];
				} else {
					console.warn(`Code file '${codeKey}' not found. Available files:`, Object.keys(codeFiles));
					return null;
				}
			}

			sprite.isTouching = function(otherId) {
				if (Array.isArray(otherId)) {
					let results = []
					const otherIDS = otherId
					for (let otherId of otherIDS) {
						const other = spritesById[otherId];
						if (!other) results.push(false)

						const a = this;
						const b = other;

						const isColliding =
							a.x < b.x + b.width &&
							a.x + a.width > b.x &&
							a.y < b.y + b.height &&
							a.y + a.height > b.y;
						
						results.push(isColliding)
					}
					return results;
					} else {
						const other = spritesById[otherId];
						if (!other) return false;

						const a = this;
						const b = other;

						const isColliding =
							a.x < b.x + b.width &&
							a.x + a.width > b.x &&
							a.y < b.y + b.height &&
							a.y + a.height > b.y;

						return isColliding;
					}
				};


			
			sprite.getTouchingSprites = function(filterFn = () => true) {
				const touching = [];

				for (const id in spritesById) {
					const other = spritesById[id];
					if (other === this || !filterFn(other)) continue;

					if (
						this.x < other.x + other.width &&
						this.x + this.width > other.x &&
						this.y < other.y + other.height &&
						this.y + this.height > other.y
					) {
						touching.push(other);
					}
				}

				return touching;
			};

			sprite.getAllSprites = function(){
				return spritesById
			}

			sprite.clone = function(code,id=""){
				let tid = ""
				if (!id) {
					tid = sprite.id.toString() + "=" + generateUUID()
				} else {
					tid = id
				}
				const sprite_data = {
					"id": tid,
					"x": sprite.x,
					"y": sprite.y,
					"width": sprite.width,
					"height": sprite.height,
					"layer": sprite.layer,
					"texture": sprite.texture,
					"opacity": sprite.opacity,
					"script": code
				}
				
				gameData.sprites.push(sprite_data);
				initSpriteData(sprite_data)
				loadImageFromData(sprite_data)
				attachSpriteHandlers(sprite_data)
				return tid
			}

			sprite.getID = function(){
				return sprite.id
			}

			// Camera control functions
			sprite.setCameraPosition = function(x, y) {
				camera.x = x;
				camera.y = y;
			}

			sprite.moveCameraBy = function(dx, dy) {
				camera.x += dx;
				camera.y += dy;
			}

			sprite.centerCameraOn = function(target) {
				if (typeof target === 'string') {
					target = spritesById[target];
				}
				if (!target) return;
				
				camera.x = target.x + (target.width / 2) - (canvas.width / 2);
				camera.y = target.y + (target.height / 2) - (canvas.height / 2);
			}

			sprite.getCameraX = function() {
				return camera.x;
			}

			sprite.getCameraY = function() {
				return camera.y;
			}

			sprite.getScreenPosition = function() {
				return {
					x: this.x - camera.x,
					y: this.y - camera.y
				};
			}

			sprite.getWorldPosition = function(screenX, screenY) {
				return {
					x: screenX + camera.x,
					y: screenY + camera.y
				};
			}

			// Animation system
			sprite._currentAnimation = null;
			sprite._animationFrames = [];
			sprite._animationInterval = null;
			sprite._currentFrame = 0;

			sprite.playAnimation = async function(jsonPath, fps) {
				// Stop any existing animation
				this.stopAnimation();

				try {
					const response = await fetch(jsonPath);
					const animationData = await response.json();

					if (animationData && animationData.frames) {
						this._animationFrames = animationData.frames;
						this._currentFrame = 0;
						this._currentAnimation = setInterval(() => {
							if (this._currentFrame >= this._animationFrames.length) {
								this._currentFrame = 0;
							}
							this.setTexture(this._animationFrames[this._currentFrame]);
							this._currentFrame++;
						}, 1000 / fps);
					}
				} catch (error) {
					console.error('Error loading animation:', error);
				}
			};

			sprite.stopAnimation = function() {
				if (this._currentAnimation) {
					clearInterval(this._currentAnimation);
					this._currentAnimation = null;
					this._animationFrames = [];
					this._currentFrame = 0;
				}
			};

			let mouseX = 0;
			let mouseY = 0;

			canvas.addEventListener('mousemove', e => {
				const rect = canvas.getBoundingClientRect();
				const scaleX = canvas.width / rect.width;
				const scaleY = canvas.height / rect.height;
				mouseX = (e.clientX - rect.left) * scaleX;
				mouseY = (e.clientY - rect.top) * scaleY;
			});

			sprite.getMouseX = function() {
				return mouseX
			}
			sprite.getMouseY = function() {
				return mouseY
			}

			//end of adding functions and start sprite
					sprite.onStart();
				} catch (e) {
					console.error(`Chyba ve skriptu ${sprite.id}:`, e);
					sprite.onStart = () => {};
					sprite.onUpdate = () => {};
					
					sprite.onClick = null;
					sprite.onRightClick = null;
					sprite.gravity = 0;

			
				}
			}

			// key inputs
			document.addEventListener('keydown', e => {
				const key = e.key.toLowerCase();
				if (!input.keydown[key]) {
					input.justPressed[key] = true;
					input.keydown[key] = true;
				}
				
				input.keyup[key] = false;
			});
			
			document.addEventListener('keyup', e => {
				const key = e.key.toLowerCase()
				
				if (!input.keyup[key]) {
					input.justReleased[key] = true;
					input.keyup[key] = true;
				}
				input.keydown[key] = false;
			});

			// mouse inputs
			canvas.addEventListener('click', e => {
				const rect = canvas.getBoundingClientRect();
				const scaleX = canvas.width / rect.width;
				const scaleY = canvas.height / rect.height;
				const mx = (e.clientX - rect.left) * scaleX;
				const my = (e.clientY - rect.top) * scaleY;

				// Přepočet pozice myši s ohledem na kameru
				const worldX = mx + camera.x;
				const worldY = my + camera.y;

				for (const sprite of gameData.sprites) {
					if (worldX >= sprite.x && worldX <= sprite.x + sprite.width &&
							worldY >= sprite.y && worldY <= sprite.y + sprite.height) {
						if (sprite.onClick) {
							try {
								sprite.onClick();
							} catch (e) {
								console.error(`Chyba onClick v ${sprite.id}:`, e);
							}
						}
					}
				}
			});

			canvas.addEventListener('mousedown', e => {
				const rect = canvas.getBoundingClientRect();
				const scaleX = canvas.width / rect.width;
				const scaleY = canvas.height / rect.height;
				const mx = (e.clientX - rect.left) * scaleX;
				const my = (e.clientY - rect.top) * scaleY;

				// Přepočet pozice myši s ohledem na kameru
				const worldX = mx + camera.x;
				const worldY = my + camera.y;

				for (const sprite of gameData.sprites) {
					if (worldX >= sprite.x && worldX <= sprite.x + sprite.width &&
							worldY >= sprite.y && worldY <= sprite.y + sprite.height) {
						if (sprite.onRightClick) {
							try {
								if (e.button===2) {
									sprite.onRightClick();
								}
								
							} catch (e) {
								console.error(`Chyba onRightClick v ${sprite.id}:`, e);
							}
						}
					}
				}
			
			});

			canvas.addEventListener('mousedown', e => {
				const button = e.button
				input.mouseup[button] = false
				if (!input.mousedown[button]) {
					input.mousedown[button] = true
				}
			
			});

			canvas.addEventListener('mouseup', e => {
				const button = e.button
				input.mousedown[button] = false
				if (!input.mouseup[button]) {
					input.mouseup[button] = true
				}
			
			});
			
			canvas.addEventListener('contextmenu', e => e.preventDefault());
		
			// Main Loop
			const targetFPS = gameData.screen.fps; 
			const frameDuration = 1000 / targetFPS;
			let lastFrameTime = 0;
			function gameLoop(currentTime) {
				

				const elapsed = currentTime - lastFrameTime;

				if (elapsed >= frameDuration) {
					lastFrameTime = currentTime;

					ctx.clearRect(0, 0, canvas.width, canvas.height);

					const sortedSprites = [...gameData.sprites].sort((a, b) => (a.layer || 0) - (b.layer || 0));
					for (const sprite of sortedSprites) {
						// Aplikuj gravitaci a pohyb (bez delta, vše jak bylo)
						if (sprite.gravity !== 0) {
							sprite.vy += sprite.gravity;
						}

						sprite.x += sprite.vx;
						sprite.y += sprite.vy;

						try {
							sprite.onUpdate(); // volání onUpdate bez předávání spritesById
						} catch (e) {
							console.error(`Chyba onUpdate v ${sprite.id}:`, e);
						}

						input.justPressed = {};
						input.justReleased = {};

						const img = images[sprite.id];
						if (img) {
							ctx.save();
							ctx.globalAlpha = sprite.opacity !== undefined ? sprite.opacity : 1;
							
							// Počítáme pozici s ohledem na kameru
							const screenX = sprite.x - camera.x;
							const screenY = sprite.y - camera.y;
							
							// Středový bod s ohledem na kameru
							const cx = screenX + sprite.width / 2;
							const cy = screenY + sprite.height / 2;
							
							// Kontrola zda je sprite viditelný v rámci obrazovky
							if (screenX + sprite.width >= 0 &&
								screenX <= canvas.width &&
								screenY + sprite.height >= 0 &&
								screenY <= canvas.height) {
								
								ctx.translate(cx, cy); // Přeneseme původ do středu obrázku
								ctx.rotate((sprite.direction || 0) * Math.PI / 180); // Rotace ve stupních na radiány

								// Vykreslení obrázku posunutého tak, aby střed byl na (0,0)
								ctx.drawImage(img, -sprite.width / 2, -sprite.height / 2, sprite.width, sprite.height);

								ctx.restore();

								// UI text s ohledem na kameru
								if (sprite.uiText) {
									ctx.save();
									ctx.fillStyle = sprite.uiTextColor || "white";
									ctx.font = `${sprite.uiTextSize || 14}px ${sprite.uiTextFont || "sans-serif"}`;
									ctx.textAlign = sprite.uiTextAlign || "center";
									ctx.textBaseline = "middle";

									let textX = screenX + sprite.width / 2;
									if (sprite.uiTextAlign === "left") textX = screenX;
									else if (sprite.uiTextAlign === "right") textX = screenX + sprite.width;

									const textY = screenY + sprite.height / 2;
									ctx.fillText(sprite.uiText, textX, textY);
									ctx.restore();
								}
							} else {
								ctx.restore(); // Obnovíme kontext i když sprite není viditelný
							}
						}
					}
				}
				

				requestAnimationFrame(gameLoop);
			}

			for (const sprite of gameData.sprites) {
				initSpriteData(sprite)
			}
			loadAllSpriteTextures()
			for (const sprite of gameData.sprites) {
					attachSpriteHandlers(sprite)
				}
			requestAnimationFrame(gameLoop);
		})();