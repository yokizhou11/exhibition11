import * as THREE from 'three';
import { repeatbuttonHandler,showToast} from './digital.js';
import gsap from 'gsap';
import { initAvatarSwitcher } from './control.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
gsap.registerPlugin();  // 确保插件正确加载



// 添加 getWebSocketUrl 函数
function getWebSocketUrl(apiKey, apiSecret) {
    var url = "wss://tts-api.xfyun.cn/v2/tts";
    var host = location.host;
    var date = new Date().toGMTString();
    var algorithm = "hmac-sha256";
    var headers = "host date request-line";
    var signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/tts HTTP/1.1`;
    var signatureSha = CryptoJS.HmacSHA256(signatureOrigin, apiSecret);
    var signature = CryptoJS.enc.Base64.stringify(signatureSha);
    var authorizationOrigin = `api_key="${apiKey}", algorithm="${algorithm}", headers="${headers}", signature="${signature}"`;
    var authorization = btoa(authorizationOrigin);
    url = `${url}?authorization=${authorization}&date=${date}&host=${host}`;
    return url;
}

let camera, scenes = {}, currentScene, renderer;
let isUserInteracting = false,
//记录鼠标按下时的位置。
onPointerDownMouseX = 0, onPointerDownMouseY = 0,
//用于存储经度和纬度，控制摄像机的旋转。
lon = 0, onPointerDownLon = 0,
lat = 0, onPointerDownLat = 0,
//用于计算摄像机的球面坐标。
phi = 0, theta = 0;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredButton = null;
const sceneButtons = {}; // 存储每个场景的按钮


// 欢迎界面的3D模型类
export class WelcomeModel {
    constructor() {
      this.container = document.getElementById('Model_wrapDiv');
      this.scene = new THREE.Scene();
      
      // 调整相机参数以适应新的位置
      this.camera = new THREE.PerspectiveCamera(
        45,
        300 / 400, // 使用固定的宽高比
        0.1,
        2000
      );
      
      this.camera.position.set(-4, 1.5, 0.6);
      this.camera.lookAt(0, 1, 0);
  
      this.renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true
      });
      this.renderer.setSize(300, 400); // 设置固定大小
      this.renderer.setClearColor(0x000000, 0); // 完全透明的背景
      this.container.appendChild(this.renderer.domElement);
  
      const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
      this.scene.add(ambientLight);

      this.textureLoader = new THREE.TextureLoader();
      
      this.actions = {};
      this.currentAction = null;
      this.isTransitioning = false;
      this.currentAnimationState = 'idle';
      this.currentListener = null; // 添加当前监听器的引用
      
      this.loadModel();
      window.addEventListener('resize', () => this.onWindowResize());
      this.modelanimate();
      
      // 添加状态控制
      this.isSpeaking = false;
      this.currentAnimationState = 'idle';
      
      // 添加音频相关属性
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.currentAudio = null;
      
      // 只创建一次音频播放器
      this.audioPlayer = new AudioPlayer(".");
      console.log('Audio player created:', this.audioPlayer);
      
      // 设置播放器事件
      this.audioPlayer.onPlay = () => {
          console.log("开始播放语音");
          // 确保音频上下文是激活的
          if (this.audioContext.state === 'suspended') {
              this.audioContext.resume();
          }
          this.playStartTalkingAnimation();
      };
      
      this.audioPlayer.onStop = () => {
          console.log("语音��放结束");
          this.playStopTalkingAnimation();
      };

      // 绑定按钮事件
      this.bindButtons();
    }
  
    // 绑定按钮事件
    bindButtons() {
        const startButton = document.getElementById('Model_newBtn');
        const closeBtnWrap = document.getElementById('Model_closeBtnWrap');
        const startBtnWrap = document.getElementById('Model_startBtnWrap');
        const closeButton = document.getElementById('Model_closeBtn');
        const talkButton = document.getElementById('Model_talkBtn');
        const taskInput = document.getElementById('Model_taskInput');

        startButton.addEventListener('click', () => {
            closeBtnWrap.style.display = 'block';
            startBtnWrap.style.display = 'none';
        });

        closeButton.addEventListener('click', () => {
            closeBtnWrap.style.display = 'none';
            startBtnWrap.style.display = 'block';
        });

        talkButton.addEventListener('click', () => {
            const text = taskInput.value.trim();
            console.log('Input text:', text); // 调试信息
            if (text) {
                this.handleSend(text);
            } else {
                showToast('请输入内容');
            }
        });
    }

    // 加载3D模型的方法
 
 
   loadModel() {
        const loader = new FBXLoader();
        
        // 加载纹理
        const bodybaseColorTexture = this.textureLoader.load('asset/model/sp/body-texture/efhpdm_1001_BaseColor.png');
        const bodynormalTexture = this.textureLoader.load('asset/model/sp/body-texture/efhpdm_1001_Normal.png');
        const bodyroughnessTexture = this.textureLoader.load('asset/model/sp/body-texture/efhpdm_1001_OcclusionRoughnessMetallic.png');
        
        const clotherbaseColorTexture = this.textureLoader.load('asset/model/sp/clothes-texture/hpdm_1001_BaseColor.png');
        const clothernormalTexture = this.textureLoader.load('asset/model/sp/clothes-texture/hpdm_1001_Normal.png');
        const clotherroughnessTexture = this.textureLoader.load('asset/model/sp/clothes-texture/hpdm_1001_OcclusionRoughnessMetallic.png');
      
        // 加载FBX模型
        loader.load('asset/model/action2.fbx', (model) => {
          // 设置模型缩放和位置
          model.scale.setScalar(0.08);
          model.position.set(0, 0, 0);
      
          // 遍历模型的所有网格
          model.traverse((child) => {
            if (child.isMesh) {      
              // 为每个网格创建PBR材质
              const material = new THREE.MeshStandardMaterial({
                transparent: true,
                side: THREE.DoubleSide,
                normalMap: bodynormalTexture, // 法线贴图（默认给body）
                roughness: 0.7, // 设置粗糙度
                metalness: 0.3, // 设置金属度
                needsUpdate: true,
              });
      
              // 根据网格名称分配贴图
              if (
                child.name === 'polySurface3217' || 
                child.name === 'polySurface3219' || 
                child.name === 'pasted__pasted__pasted__polySurface2335_copy2'
              ) {
                // clother 材质
                material.map = clotherbaseColorTexture;
                material.normalMap = clothernormalTexture;
                material.roughnessMap = clotherroughnessTexture;
              } else {
                // body 材质
                material.map = bodybaseColorTexture;
                material.normalMap = bodynormalTexture;
                material.roughnessMap = bodyroughnessTexture;
              }
              // 应用质到网格
              child.material = material;
            }
          });
      
          // 处理模型动画
          if (model.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(model);
            
            // 输出动画信息
            model.animations.forEach((anim, index) => {
                const durationInSeconds = anim.duration;
                const fps = 25; // 假设动画是25帧每秒
                const totalFrames = Math.floor(durationInSeconds * fps);
                
                console.log(`Animation ${index}:`, {
                    name: anim.name,
                    duration: durationInSeconds,
                    totalFrames: totalFrames,
                    fps: fps
                });
            });
            
            // 建不同的片段
            this.actions = {
                idle: this.createClip(model.animations[0], 'idle', 6, 100), // 从第6帧开始
                startTalking: this.createClip(model.animations[0], 'startTalking', 437, 476),
                talking: this.createClip(model.animations[0], 'talking', 476, 536),
                stopTalking: this.createClip(model.animations[0], 'stopTalking', 536, 629)
            };

            // 立即设置初始姿势
            const idleAction = this.actions.idle;
            idleAction.setEffectiveWeight(1);
            idleAction.time = 20/25;
            idleAction.play();
            
            // 立即更新混合器以应用初始姿势
            this.mixer.update(0);
            
            // 停动画并重置
            idleAction.stop();
            
            // 然后���始正常的动画循环
            this.playIdleAnimation();
          }
      
          // 将模型添加到场景
          this.scene.add(model);
          this.model = model;
      
          console.log('Model loaded:', model);
        },
        // 加载进度回调
        (xhr) => {
        //   console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        },
        // 错误回调
        (error) => {
          console.error('Error loading model:', error);
        });
      }
    // 处理窗口大小变化
    onWindowResize() {
      this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
  
    // 动画循环
    modelanimate() {
      requestAnimationFrame(() => this.modelanimate());
      
      // 更新动画混合器
      if (this.mixer) {
        this.mixer.update(1/60);
      }      
      // 渲染场景
      this.renderer.render(this.scene, this.camera);
    }

    // 创建动画片段
    createClip(animation, name, startFrame, endFrame) {
        const fps = 25;
        console.log(`Creating clip: ${name}, frames ${startFrame}-${endFrame}`); // 添加调试日志
        
        const clip = THREE.AnimationUtils.subclip(
            animation,
            name,
            startFrame,
            endFrame,
            fps
        );
        
        const action = this.mixer.clipAction(clip);
        console.log(`Created action for ${name}`); // 添加调试日志
        return action;
    }

    // 清除当前的事件监听器
    clearCurrentListener() {
        if (this.currentListener) {
            this.mixer.removeEventListener('finished', this.currentListener);
            this.currentListener = null;
        }
    }

    // 通用的动画切换方法
    switchAnimation(newAction, loop = THREE.LoopRepeat, onFinished = null) {
        this.clearCurrentListener();

        if (this.currentAction) {
            const oldAction = this.currentAction;
            newAction.reset();
            newAction.setLoop(loop);
            newAction.clampWhenFinished = true;
            newAction.crossFadeFrom(oldAction, 0.2, true);
            newAction.play();
        } else {
            newAction.reset();
            newAction.setLoop(loop);
            newAction.play();
        }

        if (onFinished) {
            const handleFinished = () => {
                this.clearCurrentListener();
                onFinished();
            };
            this.currentListener = handleFinished;
            this.mixer.addEventListener('finished', handleFinished);
        }

        this.currentAction = newAction;
    }

    playIdleAnimation() {
        this.currentAnimationState = 'idle';
        const idleAction = this.actions.idle;
        idleAction.time = 6/25;
        this.switchAnimation(idleAction, THREE.LoopPingPong);
    }

    playStartTalkingAnimation() {
        if (this.currentAnimationState === 'idle') {
            this.currentAnimationState = 'talking';
            this.switchAnimation(
                this.actions.startTalking,
                THREE.LoopOnce,
                () => {
                    if (this.currentAnimationState === 'talking') {
                        this.switchAnimation(
                            this.actions.talking,
                            THREE.LoopPingPong
                        );
                    }
                }
            );
        }
    }

    playStopTalkingAnimation() {
        if (this.currentAnimationState === 'talking') {
            this.currentAnimationState = 'stopping';
            this.switchAnimation(
                this.actions.stopTalking,
                THREE.LoopOnce,
                () => {
                    if (this.currentAnimationState === 'stopping') {
                        this.playIdleAnimation();
                    }
                }
            );
        }
    }

    async handleSend(text) {
        if (!text.trim()) {
            showToast('请输入内容');
            return;
        }

        try {
            // 1. 发送文字到 Moonshot
            const response = await fetch('http://localhost:3000/moonshot/complete', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt: text })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Moonshot API error:', errorData);
                throw new Error(errorData.details || 'Failed to get response from Moonshot');
            }

            const data = await response.json();
            console.log('Moonshot response:', data.text);
            document.getElementById('Model_taskInput').value = '';

            // 2. 初始化音频播放器
            if (!this.audioPlayer) {
                this.audioPlayer = new AudioPlayer(".");
                this.audioPlayer.start({
                    autoPlay: true,
                    sampleRate: 16000,
                    resumePlayDuration: 1000
                });
            }

            // 3. 连接讯飞语音合成 WebSocket
            const url = getWebSocketUrl(API_KEY, API_SECRET);
            const ttsWS = new WebSocket(url);
            
            ttsWS.onopen = () => {
                // 初始化音频播放器
                this.audioPlayer.start({
                    autoPlay: true,
                    sampleRate: 16000,
                    resumePlayDuration: 1000
                });
                
                const params = {
                    common: {
                        app_id: APPID,
                    },
                    business: {
                        aue: "raw",
                        auf: "audio/L16;rate=16000",
                        vcn: "xiaoyan", // 可以设置发音人
                        speed: 60,      // 语速
                        volume: 50,     // 音量
                        pitch: 60,      // 音调
                        bgs: 1,
                        tte: "UTF8",
                    },
                    data: {
                        status: 2,
                        text: Base64.encode(data.text)
                    },
                };
                ttsWS.send(JSON.stringify(params));
            };

            ttsWS.onmessage = (e) => {
                let jsonData = JSON.parse(e.data);
                // 合成失败
                if (jsonData.code !== 0) {
                    console.error(jsonData);
                    this.playStopTalkingAnimation();
                    return;
                }
                
                this.audioPlayer.postMessage({
                    type: "base64",
                    data: jsonData.data.audio,
                    isLastData: jsonData.data.status === 2,
                });
                
                if (jsonData.code === 0 && jsonData.data.status === 2) {
                    ttsWS.close();
                }
            };

            ttsWS.onerror = (error) => {
                console.error('WebSocket error:', error);
                showToast('语音合成服务连接失败');
                this.playStopTalkingAnimation();
            };

            ttsWS.onclose = () => {
                console.log('WebSocket connection closed');
            };

        } catch (error) {
            console.error('Error:', error);
            showToast(error.message || '发生错误，请重试');
            this.playStopTalkingAnimation();
        }
    }

    // 新建一个方法来处理展品按钮点击
    handleExhibitPrompt(prompt) {
        if (!prompt.trim()) {
            showToast('无效的展品介绍');
            return;
        }

        console.log('Handling exhibit prompt:', prompt); // 调试信息

        // 在这里添加处理展品介绍的逻辑
        // 例如，调用语音合成接口或其他处理逻辑
        this.handleSend(prompt); // 如果逻辑相同，可以调用现有的 handleSend 方法
    }
}

// 全景图像列表
const roomTextures = {
    '入口': 'asset/image/scene/1.jpg',
    '序厅': 'asset/image/scene/2.jpg',
    '赵陀年表1': 'asset/image/scene/3.jpg',
    '赵陀年表2': 'asset/image/scene/4.jpg',
    '赵陀年表3': 'asset/image/scene/5.jpg'
};
// 初始化所有房间
function init() {
    const container = document.getElementById('hall_container');
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1100);
    camera.position.set(0, 0, 0); // 设置摄像机初始位置
    renderer = new THREE.WebGLRenderer({ alpha: true }); // 启用透明背景
    renderer.setClearColor(0x000000, 1); // 0x000000表示黑色，1是完全不透明
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // 创建每个房间的场景
    for (let roomName in roomTextures) {
        scenes[roomName] = new THREE.Scene();
        initRoom(roomName);
        if (roomName === '入口') {
            createButton('序厅', 100, -40, -80, roomName);
        } else if (roomName === '序厅') {
            createButton('入口', -100, -20, 80,roomName);
            createButton('赵陀年表1', -80, -30, -50, roomName);
        } else if (roomName === '赵陀年表1') {
            createButton('序厅', -60, -40, -80, roomName);
            createButton('赵陀年表2', 40, -50, 100, roomName);
            createTalkButton(100, -40, -10, roomName, '展品1', '请重复’哈喽哈哈喽这是一个新的展品‘这段文字','asset/image/General/avatar.png','哈喽哈喽哈喽这是一个新的展品');
        } else if (roomName === '赵陀年表2') {
            createButton('赵陀年表1', 0, -70, -100, roomName);
            createButton('赵陀年表3', 20, -50, 120, roomName);
            createTalkButton(100, -40, -10, roomName, '展品2', '请重复‘哈喽哈喽哈喽这是一个新的展品’这段文字','asset/image/General/avatar.png','哈喽哈喽哈喽这是一个新的展品');
        }
          else if (roomName === '赵陀年表3') {
            createButton('赵陀年表2', 0, -70, -100, roomName);
            createButton('赵陀年表3', 20, -50, 120, roomName);
            createTalkButton(100, -40, -10, roomName, '展品2', '请重复’哈喽哈喽哈喽这是一个新的展品‘这段文字','asset/image/General/avatar.png','哈喽哈喽哈喽这是一个新的展品');
        }
    }

    currentScene = scenes['赵陀年表3']; // 设置当前场景为入口
    currentScene.name = '赵陀年表3';

    container.style.touchAction = 'none';
    container.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('wheel', onDocumentMouseWheel);
    document.addEventListener('resize', onWindowResize);
    document.addEventListener('pointermove', onMouseMove);
    document.addEventListener('click', onClick);
    renderer.setAnimationLoop(animate);
    initSceneSwitcher();
}

// 初始化每个房间
function initRoom(roomName) {
    const texture = new THREE.TextureLoader().load(roomTextures[roomName], (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        const material = new THREE.MeshBasicMaterial({ map: texture });

        // 每次切换场景时重新建一个新的球体
        const geometry = new THREE.SphereGeometry(800, 60, 40);
        geometry.scale(-1, 1, 1);
        const mesh = new THREE.Mesh(geometry, material);
        
        scenes[roomName].add(mesh);
    });
}
// 房间切换函数
function switchRoom(roomName) {
    const newScene = scenes[roomName];
    if (!newScene) return;
    console.log(`Switching to room: ${roomName}`);

    const currentSceneMesh = currentScene.children.find(child => child.isMesh);
    const newSceneMesh = newScene.children.find(child => child.isMesh);

    if (!currentSceneMesh || !newSceneMesh) {
        console.error('Meshes not found in the scenes!');
        return;
    }

    // GSAP 动画过渡
    gsap.timeline()
        .to(currentSceneMesh.material, {
            duration: 1,       // 动画持续时间
            opacity: 0,        // 淡出当前场景
            ease: "power3.inOut",
            onComplete: () => {
                // 渲染新场景
                currentScene = newScene;
                currentScene.name = roomName; // 更新当前场景名称
            },
        })
        .to(newSceneMesh.material, {
            duration: 1,       // 动画持续时间
            opacity: 1,        // 淡入新场景
            ease: "power3.inOut",
        }, "<"); // 在出当前场景的同时开始淡入新场景
}
// 通过按钮换场景
function initSceneSwitcher() {
    // 获 DOM 元素
    const sceneSelected = document.getElementById('scene-selected');
    const scenePopup = document.getElementById('scene-popup');
    const sceneList = document.getElementById('scene-list');

    // 动态生成场景表项
    Object.keys(roomTextures).forEach(roomName => {
        const listItem = document.createElement('li');
        listItem.textContent = roomName;  // 场景名称
        listItem.setAttribute('data-room', roomName);  // 存储场景名称

        // 为每个场景项添加点击事件
        listItem.addEventListener('click', () => {
            switchRoom(roomName);  // 切换场景
            scenePopup.style.display = 'none';  // 隐藏弹窗
            sceneSelected.classList.remove('selected');  // 恢复按钮状态
        });

        sceneList.appendChild(listItem);
    });

    // 点击场景选按钮时，切换按钮图片和显示/隐藏场景弹窗
    sceneSelected.addEventListener('mouseenter', () => {
        const isPopupVisible = scenePopup.style.display === 'block';

        if (isPopupVisible) {
            // 隐藏弹窗并恢复按钮状态
            scenePopup.style.display = 'none';
            sceneSelected.classList.remove('selected');  // 恢复原按钮图片
        } else {
            // 显示弹窗并更新按钮状态
            scenePopup.style.display = 'block';
            sceneSelected.classList.add('selected');  // 更新按钮图为选中态
        }
    });
    // 添加鼠标移出整个域时隐藏弹窗的处理
sceneSelected.addEventListener('mouseleave', () => {
    // 添加一个小延迟，避免鼠标移动到弹窗时触发隐藏
    setTimeout(() => {
        if (!sceneSelected.matches(':hover')) {
            scenePopup.style.display = 'none';
        }
    }, 100);
});

// 防止弹窗内点击事件冒泡
scenePopup.addEventListener('click', (event) => {
    event.stopPropagation();
});

}
// 创建'切换场景'按钮
function createButton(text, x, y, z, roomName) {
    //加载使用动画序列对钮进行渲染。
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 256;
    const buttonTexture = new THREE.CanvasTexture(canvas);
    const frames = [
        'asset/icon/Gif/arrowup_gif/Frame 1.png',
        'asset/icon/Gif/arrowup_gif/Frame 2.png',
        'asset/icon/Gif/arrowup_gif/Frame 3.png',
        'asset/icon/Gif/arrowup_gif/Frame 4.png',
        'asset/icon/Gif/arrowup_gif/Frame 5.png',
        'asset/icon/Gif/arrowup_gif/Frame 6.png',
        'asset/icon/Gif/arrowup_gif/Frame 7.png',
        'asset/icon/Gif/arrowup_gif/Frame 8.png',
        'asset/icon/Gif/arrowup_gif/Frame 9.png',  
        'asset/icon/Gif/arrowup_gif/Frame 10.png',
        'asset/icon/Gif/arrowup_gif/Frame 11.png',
        'asset/icon/Gif/arrowup_gif/Frame 12.png',
        'asset/icon/Gif/arrowup_gif/Frame 13.png',
        'asset/icon/Gif/arrowup_gif/Frame 14.png',
        'asset/icon/Gif/arrowup_gif/Frame 15.png',
        'asset/icon/Gif/arrowup_gif/Frame 16.png',
        'asset/icon/Gif/arrowup_gif/Frame 17.png',
        'asset/icon/Gif/arrowup_gif/Frame 18.png',
        'asset/icon/Gif/arrowup_gif/Frame 19.png',
        'asset/icon/Gif/arrowup_gif/Frame 20.png',
        'asset/icon/Gif/arrowup_gif/Frame 21.png',
        'asset/icon/Gif/arrowup_gif/Frame 22.png',
        'asset/icon/Gif/arrowup_gif/Frame 23.png',
        'asset/icon/Gif/arrowup_gif/Frame 24.png',
        'asset/icon/Gif/arrowup_gif/Frame 25.png'
    ];
    let currentFrame = 0;

    // 加载帧图片
    const frameImages = frames.map((frameSrc) => {
        const img = new Image();
        img.src = frameSrc;
        return img;
    });

    // 更新纹理动画（每隔一定时间更新）
    function updateTexture() {
        context.clearRect(0, 0, canvas.width, canvas.height);
        const frame = frameImages[currentFrame];
        if (frame.complete) {
            context.drawImage(frame, 0, 0, canvas.width, canvas.height);
            buttonTexture.needsUpdate = true; // 标记纹理需更新
        }
        currentFrame = (currentFrame + 1) % frames.length; // 循环播放帧
    }

    // 控制动画播放速度，每100毫秒更新次帧
    const frameInterval = 50; // 每帧显示200毫秒
    let animationInterval = setInterval(updateTexture, frameInterval);

    // 创建一个精灵（Sprite）作为按钮。设置按钮的位置和大。
    const buttonMaterial = new THREE.SpriteMaterial({ 
        map: buttonTexture
    });
    const button = new THREE.Sprite(buttonMaterial);
    button.scale.set(8, 8, 1);
    button.position.set(x, y, z);

    button.renderOrder = 1; // 设置按钮的渲染顺序


    // 创建按钮下方的文本 Sprite
    const textCanvas = document.createElement('canvas');
    const textContext = textCanvas.getContext('2d');

    // 态调整画布的宽高比
    const fontSize = 36;
    const textWidth = text.length * fontSize * 0.6; // 估算文字宽度（字符数 × 体大小 × 字符宽度比）
    textCanvas.width = Math.max(256, textWidth); // 设置宽度，至少为 512
    textCanvas.height = 128; // 固定高度

    // 设置字体样式
    textContext.font = ` ${fontSize}px Arial`;
    textContext.fillStyle = 'white';
    textContext.textAlign = 'center';
    textContext.textBaseline = 'middle';

    // 绘制字到画布中央
    textContext.fillText(text, textCanvas.width / 2, textCanvas.height / 2);

    
    const textTexture = new THREE.CanvasTexture(textCanvas);
    const textMaterial = new THREE.SpriteMaterial({ map: textTexture });
    const textSprite = new THREE.Sprite(textMaterial);

    // 设置 Sprite 的高比例，保文字清晰
    const aspectRatio = textCanvas.width / textCanvas.height;
    textSprite.scale.set(aspectRatio * 8, 8, 1); // 动态设置宽高比例
    textSprite.position.set(x, y - 8, z); // 调整位置在按钮下方

    // 按钮和文本添加到对应的场景中
    if (!sceneButtons[roomName]) sceneButtons[roomName] = [];
    sceneButtons[roomName].push(button);
    sceneButtons[roomName].push(textSprite);
    scenes[roomName].add(button);
    scenes[roomName].add(textSprite);

    button.name = text; // 按钮名字
}
// 显示弹窗函数
function showPopup(imageSrc, description) {
    // 获取 hall_container
    const hallContainer = document.getElementById('hall_container');

    // 创建弹窗
    const popupDiv = document.createElement('div');
    popupDiv.id = 'popup';
    popupDiv.style.position = 'fixed';
    popupDiv.style.top = '50%';
    popupDiv.style.left = '50%';
    popupDiv.style.transform = 'translate(-50%, -50%)';
    popupDiv.style.width = '80%';
    popupDiv.style.height = '80%';
    popupDiv.style.background = 'rgba(0, 0, 0, 0.6)';
    popupDiv.style.borderRadius = '10px';
    popupDiv.style.display = 'flex';
    popupDiv.style.flexDirection = 'column';
    popupDiv.style.justifyContent = 'center';
    popupDiv.style.alignItems = 'center';
    popupDiv.style.backdropFilter = 'blur(20px)';
    popupDiv.style.zIndex = '2'; // 确保在数字窗口下方

    // 添加图片
    const popupImage = document.createElement('img');
    popupImage.src = imageSrc;
    popupImage.style.maxWidth = '80%';
    popupImage.style.maxHeight = '50%';
    popupImage.style.marginBottom = '20px';
    popupDiv.appendChild(popupImage);

    // 添加文字描述
    const popupDescription = document.createElement('p');
    popupDescription.innerText = description;
    popupDescription.style.color = 'white';
    popupDescription.style.textAlign = 'center';
    popupDescription.style.padding = '0 20px';
    popupDiv.appendChild(popupDescription);

    // 添加关闭按钮
    const closeButton = document.createElement('button');
    closeButton.innerText = '关闭';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '20px';
    closeButton.style.right = '20px';
    closeButton.style.padding = '10px 20px';
    closeButton.style.background = '#444';
    closeButton.style.color = 'white';
    closeButton.style.border = 'none';
    closeButton.style.borderRadius = '5px';
    closeButton.style.cursor = 'pointer';

    closeButton.addEventListener('click', () => {
        hallContainer.removeChild(popupDiv); // 移除弹窗
    });

    popupDiv.appendChild(closeButton);

    // 将弹窗加到 hall_container
    hallContainer.appendChild(popupDiv);
}
//建'展品介绍'按钮
function createTalkButton(x, y, z, roomName,text, prompt,imageSrc, description) {
    // 创建一个 canvas 用于动态处理载体
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 256;

    // 初始化 CanvasTexture
    const buttonTexture = new THREE.CanvasTexture(canvas);

    // 动画帧序列
    const frames = [
        'asset/icon/Gif/point_gif/Frame 1.png',
        'asset/icon/Gif/point_gif/Frame 2.png',
        'asset/icon/Gif/point_gif/Frame 3.png',
        'asset/icon/Gif/point_gif/Frame 4.png',
        'asset/icon/Gif/point_gif/Frame 5.png',
        'asset/icon/Gif/point_gif/Frame 6.png',
        'asset/icon/Gif/point_gif/Frame 7.png',
        'asset/icon/Gif/point_gif/Frame 8.png',
        'asset/icon/Gif/point_gif/Frame 9.png',
        'asset/icon/Gif/point_gif/Frame 10.png',
        'asset/icon/Gif/point_gif/Frame 11.png',
        'asset/icon/Gif/point_gif/Frame 12.png',
        'asset/icon/Gif/point_gif/Frame 13.png',
        'asset/icon/Gif/point_gif/Frame 14.png',
        'asset/icon/Gif/point_gif/Frame 15.png',
        'asset/icon/Gif/point_gif/Frame 16.png',
        'asset/icon/Gif/point_gif/Frame 17.png',
        'asset/icon/Gif/point_gif/Frame 18.png',
        'asset/icon/Gif/point_gif/Frame 19.png',
        'asset/icon/Gif/point_gif/Frame 20.png',
        'asset/icon/Gif/point_gif/Frame 21.png',
        'asset/icon/Gif/point_gif/Frame 22.png',
        'asset/icon/Gif/point_gif/Frame 23.png',
        'asset/icon/Gif/point_gif/Frame 24.png',
        'asset/icon/Gif/point_gif/Frame 25.png'

    ];
    let currentFrame = 0;


    // 加载帧图片
    const frameImages = frames.map((frameSrc) => {
        const img = new Image();
        img.src = frameSrc;
        return img;
    });

    // 更新纹理动画（每一定时间更新）
    function updateTexture() {
        context.clearRect(0, 0, canvas.width, canvas.height);
        const frame = frameImages[currentFrame];
        if (frame.complete) {
            context.drawImage(frame, 0, 0, canvas.width, canvas.height);
            buttonTexture.needsUpdate = true; // 标记纹理需要更新
        }
        currentFrame = (currentFrame + 1) % frames.length; // 循环播放帧
    }

    // 控制动画播放速度，每100毫秒更新一次帧
    const frameInterval = 50; // 每帧显示200毫秒
    let animationInterval = setInterval(updateTexture, frameInterval);


    // 开始动画
    updateTexture();

    // 创建按钮
    const buttonMaterial = new THREE.SpriteMaterial({ 
        map: buttonTexture,
    });
    const button = new THREE.Sprite(buttonMaterial);
    button.scale.set(4, 4, 1); // 调按钮大小
    button.position.set(x, y, z);
    scenes[roomName].add(button);
    button.renderOrder = 1; // 设置按钮的渲染顺序



    // 创建按钮下方的文本 Sprite
    const textCanvas = document.createElement('canvas');
    const textContext = textCanvas.getContext('2d');
    textCanvas.width = 256; // 更宽的文本画布宽度
    textCanvas.height = 256; // 更高的本画布高度，增加行间距
    textContext.font = '64px Arial';  // 大的字体大小
    textContext.fillStyle = 'white';
    textContext.textAlign = 'center';
    textContext.textBaseline = 'middle';  // 设置文本垂直居中
    textContext.fillText(text, textCanvas.width / 2, textCanvas.height / 2);

    const textTexture = new THREE.CanvasTexture(textCanvas);
    const textMaterial = new THREE.SpriteMaterial({ map: textTexture });
    const textSprite = new THREE.Sprite(textMaterial);
    textSprite.scale.set(10, 8, 1); // 调整文本大小，使其可见
    textSprite.position.set(x, y - 8, z); // 设置文本位置，置在按钮下方

    // 将按钮和文本添加到对应的场景中
    if (!sceneButtons[roomName]) sceneButtons[roomName] = [];
    sceneButtons[roomName].push(button);
    sceneButtons[roomName].push(textSprite);
    scenes[roomName].add(button);
    scenes[roomName].add(textSprite);






    // 使用 Raycaster 处理点击事件
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseMove = (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // 检鼠标否悬停按钮上
        raycaster.setFromCamera(mouse, camera);
        const buttonsInCurrentScene = sceneButtons[currentScene.name] || [];
        const intersects = raycaster.intersectObjects(buttonsInCurrentScene);

        // 如果鼠标悬停在按钮上，设置鼠标为 pointer 样式
        if (intersects.length > 0) {
            document.body.style.cursor = 'pointer';  // 显示为指针样式
        } else {
            document.body.style.cursor = 'auto';  // 恢复为默认样式
        }
    };

     // 鼠标点击事件：只检测当前场景的按钮
     const onClick = () => {
        raycaster.setFromCamera(mouse, camera);

        // 获取前场景中的所有按钮
        const buttonsInCurrentScene = sceneButtons[currentScene.name] || [];
        const intersects = raycaster.intersectObjects(buttonsInCurrentScene);

        if (intersects.length > 0) {
            const clickedButton = intersects[0].object;

            // 判断按钮是否是"说话"按钮
            if (clickedButton.name === `TalkButton_${roomName}`) {
                const isCloseBtnWrapHidden = document.getElementById('closeBtnWrap').style.display === 'none';
                const isModelCloseBtnWrapHidden = document.getElementById('Model_closeBtnWrap').style.display === 'none';

                if (isCloseBtnWrapHidden && isModelCloseBtnWrapHidden) {
                    showToast('请开始对话');
                } else {
                    console.log('Current avatar:', window.currentAvatar); // 调试信息
                    if (window.currentAvatar === 'cartoon') {
                        console.log('Sending prompt to handleExhibitPrompt:', prompt); // 调试信息
                        welcomeModel.handleExhibitPrompt(prompt); // 使用现有的 WelcomeModel 实例
                    } else {
                        repeatbuttonHandler(prompt);
                    }
                    showPopup(imageSrc, description);
                }
            }
        }
    };

    // 添加事件监听
    document.addEventListener('pointermove', onMouseMove);
    document.addEventListener('click', onClick);

    // 给按钮命名
    button.name = `TalkButton_${roomName}`;
}
// 全景图内部动画循环
function animate() {
    if (isUserInteracting === false) {
        lon += 0.01;
    }
    lat = Math.max(-85, Math.min(85, lat));
    phi = THREE.MathUtils.degToRad(90 - lat);
    theta = THREE.MathUtils.degToRad(lon);
    const x = 500 * Math.sin(phi) * Math.cos(theta);
    const y = 500 * Math.cos(phi);
    const z = 500 * Math.sin(phi) * Math.sin(theta);
    camera.lookAt(x, y, z);

    renderer.render(currentScene, camera);

}
//获取网页的长宽
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
//鼠标按下事件
function onPointerDown(event) {
    if (event.isPrimary === false) return;

    isUserInteracting = true;

    onPointerDownMouseX = event.clientX;
    onPointerDownMouseY = event.clientY;

    onPointerDownLon = lon;
    onPointerDownLat = lat;

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
}
//鼠标移动事件
function onPointerMove(event) {
    if (event.isPrimary === false) return;

    lon = (onPointerDownMouseX - event.clientX) * 0.1 + onPointerDownLon;
    lat = (event.clientY - onPointerDownMouseY) * 0.1 + onPointerDownLat;
}
//鼠标松开事件
function onPointerUp() {
    if (event.isPrimary === false) return;

    isUserInteracting = false;

    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
}
//鼠标轮事件
function onDocumentMouseWheel(event) {
    const fov = camera.fov + event.deltaY * 0.05;
    camera.fov = THREE.MathUtils.clamp(fov, 10, 75);
    camera.updateProjectionMatrix();
}
//鼠标移动事件
function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}
//鼠标点击事件
function onClick() {
    //限定Raycaster检测范围： 在点击事件中调用raycaster.intersectObjects()时，明确指只检测当前场景的按钮：
    raycaster.setFromCamera(mouse, camera);
    const buttonsInCurrentScene = sceneButtons[currentScene.name] || [];
    const intersects = raycaster.intersectObjects(buttonsInCurrentScene);

    if (intersects.length > 0) {
        const clickedButton = intersects[0].object;
        switchRoom(clickedButton.name);
    }
}
// 在应用启动时创建 WelcomeModel 实例
const welcomeModel = new WelcomeModel();
init();