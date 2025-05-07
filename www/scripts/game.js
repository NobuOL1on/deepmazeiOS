import { Motion } from "@capacitor/motion";
import { Ball } from "./ball.js";
import { getImage } from "./skills.js";

class MazeGame {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.startPage = document.getElementById("startPage");
    this.startGameButton = document.getElementById("startGameButton");
    this.pauseButton = document.getElementById("pause-button");
    this.modeBackButton = document.getElementById("modeBackButton");
    this.backButton = document.getElementById("backButton");
    this.accelHandler;

    // 清除可能存在的无效数据
    this.clearInvalidData();

    // 游戏状态
    this.isPlaying = false;
    this.wasPaused = false;
    this.ball = new Ball();

    // 重置游戏状态
    this.resetGameState();

    // 添加语言支持
    this.language = localStorage.getItem("mazeGameLanguage") || "en";
    this.translations = {
      en: {
        start: "Start Game",
        pause: "Pause",
        reset: "Reset",
        level: "Level",
        permissionText: "Game needs device orientation access",
        levelComplete: "Level Complete!",
      },
      zh: {
        start: "开始游戏",
        pause: "暂停",
        reset: "重置",
        level: "关卡",
        permissionText: "游戏需要访问设备方向感应权限",
        levelComplete: "过关！",
      },
    };

    // 定义特殊关卡类型
    this.specialLevels = [
      "fog",
      "antiGravity",
      "lightning",
      "breadcrumb",
      "key",
      "fakeExit",
    ];
    this.currentSpecialLevel = null;
    this.lightningTimer = 0; // 用于控制闪电的计时器
    this.lightningDuration = 1000; // 闪电持续时间（毫秒）
    this.nextLightning = this.getRandomLightningInterval(); // 下次闪电的时间
    this.hasKey = false; // 是否获得钥匙
    this.keyPosition = { x: 0, y: 0 }; // 钥匙位置
    this.fakeExitPosition = { x: 0, y: 0 }; // 假出口位置

    this.score = 0; // 初始化分数
    this.startTime = null; // 记录关卡开始时间
    this.totalTime = 0; // 总通关时间
    this.completedLevels = 0; // 已完成的关卡数
    this.levelTimes = []; // 记录每个关卡的通关时间

    // 添加面包屑轨迹存储
    this.breadcrumbs = []; // 改为数组存储实际坐标
    this.lastBreadcrumbPosition = { x: 0, y: 0 };

    this.gameMode = null; // 'challenge' 或 'infinite'
    this.timeLeft = 30000000; // 30秒，以毫秒为单位
    this.countdownElement = document.getElementById("timeLeft");
    this.countdownContainer = document.getElementById("countdown");
    this.modeSelect = document.getElementById("modeSelect");
    this.challengeModeButton = document.getElementById("challengeModeButton");
    this.infiniteModeButton = document.getElementById("infiniteModeButton");

    // 挑战模式相关
    this.lastUpdateTime = null; // 用于计算时间差
    this.isGameOver = false; // 游戏是否结束

    // 技能系统
    this.skills = {
      // 主动技能
      wallPass: {
        id: "throughWalls",
        type: "wallPass",
        name: "Wall Pass",
        uses: 3,
        description: "Pass through a wall in the direction closest to gravity",
        effect: this.useWallPass.bind(this),
      },
      timeStop: {
        id: "timeStop",
        type: "active",
        name: "Time Stop",
        uses: 3,
        description: "Stop countdown for 5 seconds",
        effect: () => this.useTimeStop(),
      },
      globalLight: {
        id: "globalLight",
        type: "active",
        name: "Global Light",
        uses: 3,
        description: "Light up the entire maze for 5 seconds",
        effect: () => this.useGlobalLight(),
      },
      teleport: {
        id: "teleport",
        type: "active",
        name: "Teleport",
        uses: 3,
        description:
          "Teleport to a position with shorter straight-line distance to exit",
        effect: () => this.useTeleport(),
      },
      // 被动技能
      speedBoost: {
        id: "speedBoost",
        type: "passive",
        name: "Speed Boost",
        description: "Increase movement speed by 5%",
        effect: () => this.applySpeedBoost(),
      },
      timeBoots: {
        id: "timeBoots",
        type: "passive",
        name: "Time Boots",
        description: "Gain 0.02s for each cell moved",
        effect: () => this.applyTimeBoots(),
      },
      cornerSlow: {
        id: "cornerSlow",
        type: "passive",
        name: "Corner Slow",
        description: "Slow down by 10% at intersections",
        effect: () => this.applyCornerSlow(),
      },
    };

    // 技能槽
    this.skillSlots = [null];
    this.activeSkillEffects = {
      timeStopActive: false,
      globalLightActive: false,
      timeStopRemaining: 0,
      globalLightRemaining: 0,
    };

    // 技能选择相关
    this.skillSelectionLevel = 6; // 每6关触发技能选择
    this.skillSelectionActive = false;
    this.selectedSkill = null;

    this.init();
    // TODO: DEBUG
    this.showSkillSelection();
  }

  init() {
    // 绑定开始按钮事件
    this.startGameButton.addEventListener("click", async () => {
      try {
        await DeviceMotionEvent.requestPermission();
      } catch (e) {
        console.error(e);
        return;
      }

      this.bindOrientationEvents();
      this.showModeSelect();
      // Once the user approves, can start listening:
      this.accelHandler = await Motion.addListener("accel", (event) => {});
    });
    this.challengeModeButton.addEventListener("click", () =>
      this.startGame("challenge")
    );
    this.infiniteModeButton.addEventListener("click", () =>
      this.startGame("infinite")
    );
    this.modeBackButton.addEventListener("click", () => this.returnToStart());

    // 绑定技能槽点击事件
    const slots = document.getElementsByClassName("skill-slot");
    Array.from(slots).forEach((slot, index) => {
      slot.addEventListener("click", () => this.useSkill(index));
    });

    // 绑定返回按钮事件
    this.backButton.addEventListener("click", () => this.confirmBack());

    // 初始化小球选择器
    this.initBallSelector();

    document.getElementById("shopButton").addEventListener("click", () => {
      window.location.href = "shop.html";
    });
  }

  // Stop the acceleration listener
  stopAcceleration = () => {
    if (this.accelHandler) {
      this.accelHandler.remove();
    }
  };

  // Remove all listeners
  removeListeners = () => {
    Motion.removeAllListeners();
  };

  initBallSelector() {
    const carousel = document.querySelector(".ball-carousel");
    const containers = document.querySelectorAll(".ball-container");
    const dots = document.querySelectorAll(".dot");
    let startX = 0;
    let currentX = 0;
    let currentIndex = 0;

    // 触摸事件处理
    carousel.addEventListener("touchstart", (e) => {
      startX = e.touches[0].clientX;
      currentX = carousel.scrollLeft;
    });

    carousel.addEventListener("touchmove", (e) => {
      const x = e.touches[0].clientX;
      const walk = (startX - x) * 2;
      carousel.scrollLeft = currentX + walk;
    });

    carousel.addEventListener("touchend", () => {
      const containerWidth = carousel.offsetWidth;
      const newIndex = Math.round(carousel.scrollLeft / containerWidth);
      currentIndex = Math.max(0, Math.min(newIndex, 2));

      // 更新选中的小球类型
      this.ball.type = Object.keys(this.ball.types)[currentIndex];

      // 更新圆点显示
      dots.forEach((dot, i) => {
        dot.classList.toggle("active", i === currentIndex);
      });

      // 平滑滚动到选中位置
      carousel.scrollTo({
        left: currentIndex * containerWidth,
        behavior: "smooth",
      });
    });
  }

  async requestPermission() {
    try {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission === "granted") {
        this.permissionPrompt.style.display = "none";
        this.bindOrientationEvents();
      } else {
        alert("需要重力感应权限才能玩游戏");
      }
    } catch (error) {
      console.error("权限请求失败:", error);
      alert("权限请求失败");
    }
  }

  bindOrientationEvents() {
    window.addEventListener("deviceorientation", (event) => {
      if (!this.isPlaying) return;

      const baseSensitivity = 0.03;
      const ballSensitivity = this.ball.types[this.ball.type].sensitivity;
      const direction = this.currentSpecialLevel === "antiGravity" ? -1 : 1;
      this.ball.acceleration.x =
        event.gamma * baseSensitivity * ballSensitivity * direction;
      this.ball.acceleration.y =
        event.beta * baseSensitivity * ballSensitivity * direction;
    });
  }

  showModeSelect() {
    this.startPage.style.display = "none";
    this.modeSelect.style.display = "flex";
    this.modeBackButton.style.display = "flex";
  }

  startGame(mode) {
    this.gameMode = mode;
    this.isPlaying = true;
    this.isGameOver = false;
    this.modeSelect.style.display = "none";
    this.modeSelect.style.display = "none";
    document.getElementById("game-container").style.display = "flex";
    this.canvas.style.display = "block";
    document.getElementById("startButton").style.display = "none";

    // 在无限模式下显示返回按钮
    if (mode === "infinite") {
      this.backButton.style.display = "block";
    } else {
      this.backButton.style.display = "none";
    }

    // 重置游戏状态
    this.resetGameState();
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
    this.ball.reset(this.cellSize);
    this.generateMaze();

    if (mode === "challenge") {
      this.countdownContainer.style.display = "block";
      document.getElementById("skillSlots").style.display = "block";
<<<<<<< HEAD
      this.timeLeft = 30000; // 30秒
=======
>>>>>>> fae73f6cf53ecfc0feda0f11997e954c5ec517db
      this.lastUpdateTime = Date.now();
      this.updateCountdown();
    } else {
      this.countdownContainer.style.display = "none";
      document.getElementById("skillSlots").style.display = "none";
    }

    this.startTime = Date.now();
    this.gameLoop();
  }

  pauseGame() {
    this.isPlaying = false;
  }

  resumeGame() {
    this.isPlaying = true;
    this.wasPaused = true;
    this.gameLoop();
  }

  resizeCanvas() {
    const container = document.getElementById("game-container");
    this.canvas.width = Math.min(container.clientWidth - 20, 400);
    this.canvas.height = Math.min(container.clientHeight * 0.7, 600);
    this.ball.reset(this.cellSize);
  }

  update() {
    this.ball.updateVelocity();

    // 检测是否与墙壁接触
    let touchingWall = false;
    const cellX = Math.floor(this.ball.x / this.cellSize);
    const cellY = Math.floor(this.ball.y / this.cellSize);

    // 检查周围的单元格是否是墙
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const checkY = cellY + dy;
        const checkX = cellX + dx;

        if (
          checkY >= 0 &&
          checkY < this.maze.length &&
          checkX >= 0 &&
          checkX < this.maze[0].length &&
          this.maze[checkY][checkX] === 1
        ) {
          const wallX = checkX * this.cellSize;
          const wallY = checkY * this.cellSize;

          const closestX = Math.max(
            wallX,
            Math.min(this.ball.x, wallX + this.cellSize)
          );
          const closestY = Math.max(
            wallY,
            Math.min(this.ball.y, wallY + this.cellSize)
          );

          const distanceX = this.ball.x - closestX;
          const distanceY = this.ball.y - closestY;
          const distance = Math.sqrt(
            distanceX * distanceX + distanceY * distanceY
          );

          if (distance < this.ball.radius) {
            touchingWall = true;

            // 碰撞响应
            const overlap = this.ball.radius - distance;
            const angle = Math.atan2(distanceY, distanceX);

            // 将小球推出墙壁
            this.ball.x += Math.cos(angle) * overlap;
            this.ball.y += Math.sin(angle) * overlap;

            // 计算反弹速度
            const normal = { x: Math.cos(angle), y: Math.sin(angle) };
            const velocityDotNormal =
              this.ball.velocity.x * normal.x + this.ball.velocity.y * normal.y;

            // 反弹速度调整
            const bounceDamping = 0.5; // 反弹衰减系数
            this.ball.velocity.x -=
              2 * velocityDotNormal * normal.x * bounceDamping;
            this.ball.velocity.y -=
              2 * velocityDotNormal * normal.y * bounceDamping;

            // 减少反弹后的速度以模拟摩擦
            this.ball.velocity.x *= 0.9; // 模拟摩擦
            this.ball.velocity.y *= 0.9; // 模拟摩擦
          }
        }
      }
    }

    // 更新主动技能效果
    if (this.gameMode === "challenge") {
      const currentTime = Date.now();

      // 更新时间停止效果
      if (this.activeSkillEffects.timeStopActive) {
        // 使用固定的时间间隔来更新
        const deltaTime = 16; // 约60fps
        this.activeSkillEffects.timeStopRemaining -= deltaTime;
        if (this.activeSkillEffects.timeStopRemaining <= 0) {
          this.activeSkillEffects.timeStopActive = false;
        }
      }

      // 更新全局照明效果
      if (this.activeSkillEffects.globalLightActive) {
        const deltaTime = 16; // 约60fps
        this.activeSkillEffects.globalLightRemaining -= deltaTime;
        if (this.activeSkillEffects.globalLightRemaining <= 0) {
          this.activeSkillEffects.globalLightActive = false;
          // 添加视觉反馈
          this.showEffectEndIndicator();
        }
      }
    }

    // 应用被动技能效果
    let speedMultiplier = 1;

    // 应用加速效果
    if (this.hasPassiveSkill("speedBoost")) {
      speedMultiplier *= 1.05; // 增加5%速度
    }

    // 应用转角减速效果
    if (this.hasPassiveSkill("cornerSlow")) {
      const cellX = Math.floor(this.ball.x / this.cellSize);
      const cellY = Math.floor(this.ball.y / this.cellSize);
      if (this.isIntersection(cellX, cellY)) {
        speedMultiplier *= 0.9; // 减少10%速度
      }
    }

    // 应用时间靴子效果
    if (this.hasPassiveSkill("timeBoots")) {
      const newCellX = Math.floor(this.ball.x / this.cellSize);
      const newCellY = Math.floor(this.ball.y / this.cellSize);
      if (newCellX !== this.lastCell?.x || newCellY !== this.lastCell?.y) {
        this.timeLeft += 20; // 增加0.02秒
        this.lastCell = { x: newCellX, y: newCellY };
      }
    }

    this.ball.updatePosition(speedMultiplier);

    // 检查是否到达终点
    if (this.maze[cellY][cellX] === 3) {
      // 在钥匙关卡中，必须先获得钥匙才能通关
      if (this.currentSpecialLevel === "key" && !this.hasKey) {
        return;
      }
      this.levelComplete();
    }

    // 检查是否获得钥匙
    if (this.currentSpecialLevel === "key" && !this.hasKey) {
      const dx = this.ball.x - this.keyPosition.x;
      const dy = this.ball.y - this.keyPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < this.ball.radius + 10) {
        this.hasKey = true;
      }
    }

    // 记录面包屑
    if (this.currentSpecialLevel === "breadcrumb") {
      const dx = this.ball.x - this.lastBreadcrumbPosition.x;
      const dy = this.ball.y - this.lastBreadcrumbPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // 每移动5像素记录一个点
      if (distance >= 5) {
        this.breadcrumbs.push({ x: this.ball.x, y: this.ball.y });
        this.lastBreadcrumbPosition = { x: this.ball.x, y: this.ball.y };
      }
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 如果是钥匙关卡且还没获得钥匙，绘制钥匙
    if (this.currentSpecialLevel === "key" && !this.hasKey) {
      this.ctx.fillStyle = "#000"; // 改为黑色
      this.ctx.lineWidth = 2;

      // 绘制钥匙头部（圆圈）
      this.ctx.beginPath();
      this.ctx.arc(
        this.keyPosition.x,
        this.keyPosition.y - 5,
        5,
        0,
        Math.PI * 2
      );
      this.ctx.stroke(); // 改用描边而不是填充

      // 绘制钥匙柄（竖线）
      this.ctx.beginPath();
      this.ctx.moveTo(this.keyPosition.x, this.keyPosition.y - 2);
      this.ctx.lineTo(this.keyPosition.x, this.keyPosition.y + 8);
      this.ctx.stroke();

      // 绘制钥匙齿（两根横线）
      this.ctx.beginPath();
      this.ctx.moveTo(this.keyPosition.x, this.keyPosition.y + 8);
      this.ctx.lineTo(this.keyPosition.x + 6, this.keyPosition.y + 8);
      this.ctx.moveTo(this.keyPosition.x, this.keyPosition.y + 6);
      this.ctx.lineTo(this.keyPosition.x + 4, this.keyPosition.y + 6);
      this.ctx.stroke();
    }

    // 如果是假出口关卡，绘制假出口
    if (this.currentSpecialLevel === "fakeExit") {
      const cellX = this.fakeExitPosition.x * this.cellSize;
      const cellY = this.fakeExitPosition.y * this.cellSize;
      this.ctx.beginPath();
      this.ctx.strokeStyle = "#000";
      this.ctx.lineWidth = 2;
      const radius = this.cellSize * 0.3;
      this.ctx.arc(
        cellX + this.cellSize / 2,
        cellY + this.cellSize / 2,
        radius,
        0,
        Math.PI * 2
      );
      this.ctx.stroke();
    }

    // 处理特殊关卡效果
    if (
      this.currentSpecialLevel === "fog" ||
      this.currentSpecialLevel === "lightning" ||
      this.currentSpecialLevel === "breadcrumb"
    ) {
      // 如果全局照明技能激活，则不应用特殊效果
      if (this.activeSkillEffects.globalLightActive) {
        // 绘制普通迷宫
        this.drawNormalMaze();
      } else {
        // 应用特殊效果
        if (this.currentSpecialLevel === "fog") {
          this.ctx.fillStyle = "#000";
          this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

          // 先绘制墙壁
          for (let y = 0; y < this.maze.length; y++) {
            for (let x = 0; x < this.maze[0].length; x++) {
              const cell = this.maze[y][x];
              const cellX = x * this.cellSize;
              const cellY = y * this.cellSize;

              if (cell === 1) {
                this.ctx.fillStyle = "#000";
                this.ctx.fillRect(cellX, cellY, this.cellSize, this.cellSize);
              } else if (cell === 3) {
                this.ctx.beginPath();
                this.ctx.strokeStyle = "#000";
                this.ctx.lineWidth = 2;
                const radius = this.cellSize * 0.3;
                this.ctx.arc(
                  cellX + this.cellSize / 2,
                  cellY + this.cellSize / 2,
                  radius,
                  0,
                  Math.PI * 2
                );
                this.ctx.stroke();
              }
            }
          }

          // 创建可见区域
          this.ctx.save();
          this.ctx.globalCompositeOperation = "destination-out";
          this.ctx.fillStyle = "#000";
          this.ctx.beginPath();
          this.ctx.arc(
            this.ball.x,
            this.ball.y,
            this.ball.radius * 10,
            0,
            Math.PI * 2
          );
          this.ctx.fill();
          this.ctx.restore();

          // 在可见区域内绘制白色地面
          this.ctx.save();
          this.ctx.beginPath();
          this.ctx.arc(
            this.ball.x,
            this.ball.y,
            this.ball.radius * 10,
            0,
            Math.PI * 2
          );
          this.ctx.clip();
          this.ctx.fillStyle = "#fff";
          this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        } else if (this.currentSpecialLevel === "breadcrumb") {
          // 绘制黑色背景
          this.ctx.fillStyle = "#000";
          this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

          // 先绘制墙壁
          for (let y = 0; y < this.maze.length; y++) {
            for (let x = 0; x < this.maze[0].length; x++) {
              const cell = this.maze[y][x];
              const cellX = x * this.cellSize;
              const cellY = y * this.cellSize;

              if (cell === 1) {
                this.ctx.fillStyle = "#000";
                this.ctx.fillRect(cellX, cellY, this.cellSize, this.cellSize);
              }
            }
          }

          // 绘制面包屑轨迹
          if (this.breadcrumbs.length > 1) {
            // 使用圆形笔刷绘制轨迹
            for (let i = 0; i < this.breadcrumbs.length; i++) {
              this.ctx.beginPath();
              this.ctx.arc(
                this.breadcrumbs[i].x,
                this.breadcrumbs[i].y,
                this.ball.radius * 2,
                0,
                Math.PI * 2
              );
              this.ctx.fillStyle = "#fff";
              this.ctx.fill();
            }
          }

          // 创建当前位置的可见区域（只影响地面）
          this.ctx.save();
          this.ctx.globalCompositeOperation = "destination-out";
          this.ctx.fillStyle = "#000";
          this.ctx.beginPath();
          this.ctx.arc(
            this.ball.x,
            this.ball.y,
            this.ball.radius * 2,
            0,
            Math.PI * 2
          );
          this.ctx.fill();
          this.ctx.restore();

          // 最后绘制终点圆圈，确保始终可见
          for (let y = 0; y < this.maze.length; y++) {
            for (let x = 0; x < this.maze[0].length; x++) {
              if (this.maze[y][x] === 3) {
                const cellX = x * this.cellSize;
                const cellY = y * this.cellSize;
                this.ctx.beginPath();
                this.ctx.strokeStyle = "#fff"; // 改为白色以便在黑暗中更容易看见
                this.ctx.lineWidth = 2;
                const radius = this.cellSize * 0.3;
                this.ctx.arc(
                  cellX + this.cellSize / 2,
                  cellY + this.cellSize / 2,
                  radius,
                  0,
                  Math.PI * 2
                );
                this.ctx.stroke();
              }
            }
          }
        } else if (this.currentSpecialLevel === "lightning") {
          const currentTime = Date.now();
          if (currentTime - this.lightningTimer > this.nextLightning) {
            this.lightningTimer = currentTime;
            this.nextLightning = this.getRandomLightningInterval();
          }

          if (currentTime - this.lightningTimer < this.lightningDuration) {
            // 闪电效果，整个迷宫可见
          } else {
            // 黑暗效果，仅小球周围有微弱光
            this.ctx.fillStyle = "#000";
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.arc(
              this.ball.x,
              this.ball.y,
              this.ball.radius * 0.5,
              0,
              Math.PI * 2
            ); // 微弱光
            this.ctx.clip();
          }
        } else if (this.currentSpecialLevel === "key") {
          // 绘制终点圆圈
          for (let y = 0; y < this.maze.length; y++) {
            for (let x = 0; x < this.maze[0].length; x++) {
              if (this.maze[y][x] === 3) {
                const cellX = x * this.cellSize;
                const cellY = y * this.cellSize;
                this.ctx.beginPath();
                this.ctx.strokeStyle = "#000"; // 保持普通模式的黑色
                this.ctx.lineWidth = 2;
                const radius = this.cellSize * 0.3;
                this.ctx.arc(
                  cellX + this.cellSize / 2,
                  cellY + this.cellSize / 2,
                  radius,
                  0,
                  Math.PI * 2
                );
                this.ctx.stroke();
              }
            }
          }
        }
      }
    }

    for (let y = 0; y < this.maze.length; y++) {
      for (let x = 0; x < this.maze[0].length; x++) {
        const cell = this.maze[y][x];
        const cellX = x * this.cellSize;
        const cellY = y * this.cellSize;

        this.ctx.fillStyle = cell === 1 ? "#000" : "#fff";

        if (cell === 1) {
          this.ctx.fillRect(cellX, cellY, this.cellSize, this.cellSize);
        } else if (cell === 3) {
          this.ctx.beginPath();
          this.ctx.strokeStyle = "#000";
          this.ctx.lineWidth = 2;
          const radius = this.cellSize * 0.3;
          this.ctx.arc(
            cellX + this.cellSize / 2,
            cellY + this.cellSize / 2,
            radius,
            0,
            Math.PI * 2
          );
          this.ctx.stroke();
        }
      }
    }

    if (
      this.currentSpecialLevel === "fog" ||
      this.currentSpecialLevel === "lightning" ||
      this.currentSpecialLevel === "breadcrumb" ||
      this.currentSpecialLevel === "key" ||
      this.currentSpecialLevel === "fakeExit"
    ) {
      this.ctx.restore();
    }

    // 绘制小球
    this.ctx.beginPath();
    this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    // 如果是闪电关卡，添加白色轮廓
    if (this.currentSpecialLevel === "lightning") {
      this.ctx.strokeStyle = "#fff";
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }
    this.ctx.fillStyle = this.ball.color;
    this.ctx.fill();
    this.ctx.closePath();

    // 在页面左上角绘制关卡信息
    // this.ctx.fillStyle = "#fff"; // 改为白色
    // this.ctx.font = "bold 24px Arial";
    // let levelText = `LEVEL ${this.level}`;
    // if (this.currentSpecialLevel) {
    //   const specialLevelNames = {
    //     fog: "Fog",
    //     antiGravity: "Anti-Gravity",
    //     lightning: "Lightning",
    //     breadcrumb: "Breadcrumb",
    //     key: "Key",
    //     fakeExit: "Fake Exit",
    //   };
    //   levelText += ` - ${specialLevelNames[this.currentSpecialLevel]}`;
    // }
    // this.ctx.fillText(levelText, 10, 30);
  }

  gameLoop() {
    // 更新倒计时
    if (this.gameMode === "challenge" && !this.isGameOver) {
      const currentTime = Date.now();
      if (this.activeSkillEffects.timeStopActive || this.wasPaused) {
        this.lastUpdateTime = currentTime;
      }

      this.timeLeft -= currentTime - this.lastUpdateTime;
      this.lastUpdateTime = currentTime;

      // 检查游戏结束条件
      if (this.timeLeft <= 0) {
        this.gameOver();
        return;
      }
      this.updateCountdown();
    }

    if (this.wasPaused) {
      this.wasPaused = false;
    }

    if (!this.isPlaying) return;

    // 更新物理状态
    this.update();
    // 绘制画面
    this.draw();

    requestAnimationFrame(() => this.gameLoop());
  }

  gameOver() {
    this.isGameOver = true;
    this.isPlaying = false;
    alert(`Game Over! You reached Level ${this.level}`);
    // 返回开始界面
    this.startPage.style.display = "flex";
    this.startGameButton.style.display = "block";
    this.modeSelect.style.display = "none";
    document.getElementById("game-container").style.display = "none";
    this.countdownContainer.style.display = "none";
    // 清空技能槽
    this.skillSlots = [null];
    this.updateSkillSlots();
    // 重置游戏状态
    this.resetGameState();
  }

  calculateRewardTime() {
    // 计算当前层级
    const tier = Math.floor((this.level - 1) / 10);

    // 计算基础奖励时间A
    let baseReward = 8; // 初始8秒
    for (let i = 0; i < tier; i++) {
      baseReward *= 1.1; // 每层级增加10%
    }
    baseReward = Number(baseReward.toFixed(2)); // 保留两位小数

    // 根据特殊关卡类型计算最终奖励
    let multiplier = 1;
    if (this.currentSpecialLevel) {
      switch (this.currentSpecialLevel) {
        case "fog":
        case "lightning":
        case "fakeExit":
          multiplier = 2;
          break;
        case "antiGravity":
        case "key":
          multiplier = 1.3;
          break;
        case "breadcrumb":
          multiplier = 1.6;
          break;
      }
    }

    return baseReward * multiplier * 1000; // 转换为毫秒
  }

  levelComplete() {
    if (this.gameMode === "challenge") {
      // 添加奖励时间
      const rewardTime = this.calculateRewardTime();
      this.timeLeft += rewardTime;
      this.updateCountdown();
      // 检查是否需要触发技能选择
      this.checkSkillSelection();
    }

    const timeTaken = (Date.now() - this.startTime) / 1000;
    this.levelTimes.push(timeTaken);

    const averageTime = Math.floor(
      this.levelTimes.reduce((a, b) => a + b, 0) / this.levelTimes.length
    );

    if (
      this.currentSpecialLevel === "antiGravity" &&
      timeTaken < 2 * averageTime
    ) {
      const reduction = averageTime * 0.1;
      this.totalTime -= reduction * this.completedLevels;
    } else if (
      this.currentSpecialLevel === "fog" &&
      timeTaken < 5 * averageTime
    ) {
      const reduction = averageTime * 0.1;
      this.totalTime -= reduction * this.completedLevels;
    }

    this.level++;
    localStorage.setItem("mazeLevel", this.level);

    if (this.level > this.highScore) {
      this.highScore = this.level;
      localStorage.setItem("mazeHighScore", this.highScore);
    }

    this.generateMaze();
  }

  formatTime(seconds) {
    const ms = Math.floor((seconds % 1) * 1000);
    const s = Math.floor(seconds) % 60;
    const m = Math.floor(seconds / 60) % 60;
    const h = Math.floor(seconds / 3600);
    return `${h.toString().padStart(2, "0")}:${m
      .toString()
      .padStart(2, "0")}:${s.toString().padStart(2, "0")}:${ms
      .toString()
      .padStart(3, "0")}`;
  }

  getRandomLightningInterval() {
    return 2000 + Math.random() * 2000; // 平均3秒，范围2-4秒
  }

  clearInvalidData() {
    // 如果存储的数据无效，清除所有游戏相关的本地存储
    try {
      const level = parseInt(localStorage.getItem("mazeLevel"));
      if (isNaN(level) || level < 1) {
        localStorage.removeItem("mazeLevel");
        localStorage.removeItem("mazeHighScore");
      }
    } catch (e) {
      localStorage.clear();
    }
  }

  resetGameState() {
    // 重置所有游戏状态
    this.level = 1;
    this.highScore = parseInt(localStorage.getItem("mazeHighScore")) || 0;
    this.maze = [];
    this.cellSize = 30; // 添加单元格尺寸
    this.levelTimes = [];
    this.totalTime = 0;
    this.completedLevels = 0;
    this.currentSpecialLevel = null;
    this.endX = 0; // 添加终点坐标
    this.endY = 0;
    this.ball = new Ball();
    this.hasKey = false;
    this.keyPosition = { x: 0, y: 0 };
    this.fakeExitPosition = { x: 0, y: 0 };
    // 重置技能相关状态
    this.skillSlots = [null];
    this.activeSkillEffects = {
      timeStopActive: false,
      globalLightActive: false,
      timeStopRemaining: 0,
      globalLightRemaining: 0,
    };
  }

  updateCountdown() {
    if (this.gameMode !== "challenge") return;

    const minutes = Math.floor(this.timeLeft / 60000);
    const seconds = Math.floor((this.timeLeft % 60000) / 1000);
    const milliseconds = this.timeLeft % 1000;

    this.countdownElement.textContent = `${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}:${milliseconds
      .toString()
      .padStart(3, "0")}`;
  }

  // 添加迷宫生成方法
  generateMaze() {
    // 增加初始迷宫大小
    const baseWidth = 11; // 基础宽度增加
    const baseHeight = 15; // 基础高度增加
    const width = Math.min(baseWidth + Math.floor(this.level / 2), 25);
    const height = Math.min(baseHeight + Math.floor(this.level / 2), 35);

    this.maze = Array(height)
      .fill()
      .map(() => Array(width).fill(1));

    // 使用改进的迷宫生成算法
    this.carvePassages(1, 1);

    // 设置起点为前一关的终点
    if (this.level > 1) {
      this.maze[this.endY][this.endX] = 0; // 清除前一关的终点标记
      this.ball.x = (this.endX + 0.5) * this.cellSize;
      this.ball.y = (this.endY + 0.5) * this.cellSize;
    } else {
      this.ball.reset(this.cellSize); // 第一关重置小球位置
    }

    // 随机选择出口位置
    this.placeExit(width, height);

    // 确定是否为特殊关卡
    if (this.level % 3 === 0) {
      this.currentSpecialLevel =
        this.specialLevels[
          Math.floor(Math.random() * this.specialLevels.length)
        ];
      // 如果是钥匙关卡，初始化钥匙
      if (this.currentSpecialLevel === "key") {
        this.hasKey = false;
        this.placeKey();
      } else if (this.currentSpecialLevel === "fakeExit") {
        this.placeFakeExit();
      }
    } else {
      this.currentSpecialLevel = null;
    }

    // 重置面包屑
    this.breadcrumbs = [];
    // 重置最后面包屑位置
    this.lastBreadcrumbPosition = {
      x: this.ball.x,
      y: this.ball.y,
    };

    // 调整画布大小
    this.canvas.width = width * this.cellSize - 1;
    this.canvas.height = height * this.cellSize;
  }

  carvePassages(y, x) {
    const directions = [
      [0, 2],
      [2, 0],
      [0, -2],
      [-2, 0],
    ].sort(() => Math.random() - 0.5);

    this.maze[y][x] = 0; // 标记当前位置为通道

    for (const [dy, dx] of directions) {
      const newY = y + dy;
      const newX = x + dx;

      if (
        newY > 0 &&
        newY < this.maze.length - 1 &&
        newX > 0 &&
        newX < this.maze[0].length - 1 &&
        this.maze[newY][newX] === 1
      ) {
        // 打通中间的墙
        this.maze[y + dy / 2][x + dx / 2] = 0;
        this.carvePassages(newY, newX);
      }
    }

    // 增加岔路和死胡同
    if (Math.random() < 0.3) {
      // 30% 概率增加岔路
      const randomDirection =
        directions[Math.floor(Math.random() * directions.length)];
      const randomY = y + randomDirection[0];
      const randomX = x + randomDirection[1];
      if (
        randomY > 0 &&
        randomY < this.maze.length - 1 &&
        randomX > 0 &&
        randomX < this.maze[0].length - 1
      ) {
        this.maze[randomY][randomX] = 0;
      }
    }
  }

  placeExit(width, height) {
    do {
      this.endY = Math.floor(Math.random() * (height - 2)) + 1;
      this.endX = Math.floor(Math.random() * (width - 2)) + 1;
    } while (
      this.maze[this.endY][this.endX] !== 0 ||
      (this.endY < 3 && this.endX < 3)
    ); // 确保出口不在起始点附近且在可达区域

    this.maze[this.endY][this.endX] = 3; // 终点标记
  }

  placeKey() {
    let keyX, keyY;
    do {
      keyX = Math.floor(Math.random() * (this.maze[0].length - 2)) + 1;
      keyY = Math.floor(Math.random() * (this.maze.length - 2)) + 1;
    } while (
      this.maze[keyY][keyX] !== 0 || // 确保钥匙在通道上
      (keyX < 3 && keyY < 3) || // 不要太靠近起点
      (Math.abs(keyX - this.endX) < 2 && Math.abs(keyY - this.endY) < 2) // 不要太靠近终点
    );

    this.keyPosition = {
      x: (keyX + 0.5) * this.cellSize,
      y: (keyY + 0.5) * this.cellSize,
    };
  }

  placeFakeExit() {
    let fakeX, fakeY;
    do {
      fakeX = Math.floor(Math.random() * (this.maze[0].length - 2)) + 1;
      fakeY = Math.floor(Math.random() * (this.maze.length - 2)) + 1;
    } while (
      this.maze[fakeY][fakeX] !== 0 || // 确保假出口在通道上
      (fakeX < 3 && fakeY < 3) || // 不要太靠近起点
      (Math.abs(fakeX - this.endX) < 4 && Math.abs(fakeY - this.endY) < 4) || // 不要太靠近真出口
      this.maze[fakeY][fakeX] === 3 // 不能和真出口重叠
    );

    this.fakeExitPosition = {
      x: fakeX,
      y: fakeY,
    };
  }

  // 检查是否需要触发技能选择
  checkSkillSelection() {
    if (
      this.gameMode === "challenge" &&
      this.level % this.skillSelectionLevel === 0
    ) {
      this.showSkillSelection();
    }
  }

  // 获取可选技能
  getAvailableSkills() {
    const availableSkills = [];
    for (const [id, skill] of Object.entries(this.skills)) {
      // 如果是被动技能且已装备，则跳过
      if (
        skill.type === "passive" &&
        this.skillSlots.some((slot) => slot && slot.name === skill.name)
      ) {
        continue;
      }
      availableSkills.push({ ...skill, id });
    }
    // 随机选择两个技能
    return this.shuffleArray(availableSkills).slice(0, 2);
  }

  // Fisher-Yates 洗牌算法
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  showSkillSelection() {
    this.skillSelectionActive = true;
    this.selectedSkill = null;
    this.isPlaying = false; // 暂停游戏

    document.getElementById("skillCloseButton").onclick = () => {
      skillSelection.style.display = "none";
      this.skillSelectionActive = false;
      this.lastUpdateTime = Date.now();
      this.isPlaying = true;
      requestAnimationFrame(() => this.gameLoop());
    };

    const options = document.getElementById("skillSelection").getElementsByClassName("skill-option");
    const availableSkills = this.getAvailableSkills();

    // 更新两个技能选项
    Array.from(options).forEach((option, index) => {
      const skill = availableSkills[index];
      const iconDiv = option.querySelector(".skill-icon");
      const descriptionDiv = option.querySelector(".skill-description");

      // 清除之前的内容
      
      descriptionDiv.textContent = skill.description;
      this.drawSkillIcon(iconDiv, skill);
      option.onclick = () => {
        this.selectedSkill = skill;
      };
    });

    document.getElementById("skillSelectButton").onclick = () => {
      this.equipSkill(this.selectedSkill);
    };

    skillSelection.style.display = "block";
  }

  drawSkillIcon(container, skill) {
    let img = document.createElement('img');
    img.src = getImage(skill);
    img.width = 60;
    img.height = 60;
    container.append(img);
    // const canvas = document.createElement("canvas");
    // canvas.width = 50;
    // canvas.height = 50;
    // container.appendChild(canvas);
    // const ctx = canvas.getContext("2d");

    // ctx.strokeStyle = "#000";
    // ctx.lineWidth = 2;

    // // 绘制技能图标
    // switch (skill.id) {
    //   case "wallPass":
    //     // 三条平行箭头穿过窄平行四边形
    //     const arrowWidth = canvas.width * 0.15;
    //     const spacing = canvas.width * 0.2;
    //     const wallWidth = canvas.width * 0.2; // 原来是 0.6，现在是 0.2
    //     const wallStartX = (canvas.width - wallWidth) / 2; // 居中
    //     ctx.moveTo(wallStartX, canvas.height * 0.2);
    //     ctx.lineTo(wallStartX + wallWidth, canvas.height * 0.2);
    //     ctx.lineTo(wallStartX + wallWidth * 0.8, canvas.height * 0.8);
    //     ctx.lineTo(wallStartX - wallWidth * 0.2, canvas.height * 0.8);
    //     ctx.closePath();
    //     ctx.stroke();

    //     // 绘制三个箭头
    //     for (let i = 0; i < 3; i++) {
    //       const y = canvas.height * (0.3 + i * 0.2); // 上中下三个位置
    //       this.drawArrow(ctx, canvas.width * 0.3, y, arrowWidth);
    //     }
    //     break;

    //   case "timeStop":
    //     // 暂停符号
    //     const barWidth = canvas.width * 0.15;
    //     const barHeight = canvas.height * 0.4;
    //     ctx.fillRect(
    //       canvas.width * 0.3,
    //       canvas.height * 0.3,
    //       barWidth,
    //       barHeight
    //     );
    //     ctx.fillRect(
    //       canvas.width * 0.6,
    //       canvas.height * 0.3,
    //       barWidth,
    //       barHeight
    //     );
    //     break;

    //   case "globalLight":
    //     // 灯泡图案
    //     ctx.beginPath();
    //     // 灯泡底部
    //     ctx.arc(
    //       canvas.width / 2,
    //       canvas.height * 0.4,
    //       canvas.width * 0.25,
    //       0,
    //       Math.PI * 2
    //     );
    //     // 灯泡螺纹
    //     ctx.moveTo(canvas.width * 0.4, canvas.height * 0.65);
    //     ctx.lineTo(canvas.width * 0.6, canvas.height * 0.65);
    //     ctx.moveTo(canvas.width * 0.42, canvas.height * 0.7);
    //     ctx.lineTo(canvas.width * 0.58, canvas.height * 0.7);
    //     ctx.moveTo(canvas.width * 0.45, canvas.height * 0.75);
    //     ctx.lineTo(canvas.width * 0.55, canvas.height * 0.75);
    //     ctx.stroke();
    //     break;

    //   case "teleport":
    //     // 随机传送图标
    //     const radius = canvas.width * 0.2;
    //     ctx.beginPath();
    //     ctx.arc(canvas.width / 2, canvas.height / 2, radius, 0, Math.PI * 2);
    //     // 添加箭头
    //     this.drawArrow(
    //       ctx,
    //       canvas.width * 0.3,
    //       canvas.height * 0.3,
    //       radius,
    //       Math.PI * 0.25
    //     );
    //     this.drawArrow(
    //       ctx,
    //       canvas.width * 0.7,
    //       canvas.height * 0.7,
    //       radius,
    //       -Math.PI * 0.75
    //     );
    //     ctx.stroke();
    //     break;

    //   case "speedBoost":
    //     // 闪电图标
    //     ctx.beginPath();
    //     ctx.moveTo(canvas.width * 0.6, canvas.height * 0.2);
    //     ctx.lineTo(canvas.width * 0.4, canvas.height * 0.5);
    //     ctx.lineTo(canvas.width * 0.5, canvas.height * 0.5);
    //     ctx.lineTo(canvas.width * 0.3, canvas.height * 0.8);
    //     ctx.lineTo(canvas.width * 0.7, canvas.height * 0.5);
    //     ctx.lineTo(canvas.width * 0.5, canvas.height * 0.5);
    //     ctx.closePath();
    //     ctx.fill();
    //     break;

    //   case "timeBoots":
    //     // 秒表图案
    //     ctx.beginPath();
    //     ctx.arc(
    //       canvas.width / 2,
    //       canvas.height / 2,
    //       canvas.width * 0.3,
    //       0,
    //       Math.PI * 2
    //     );
    //     // 指针
    //     ctx.moveTo(canvas.width / 2, canvas.height / 2);
    //     ctx.lineTo(canvas.width * 0.7, canvas.height * 0.5);
    //     ctx.stroke();
    //     break;

    //   case "cornerSlow":
    //     // 十字路口图案
    //     const roadWidth = canvas.width * 0.2;
    //     ctx.strokeRect(
    //       canvas.width / 2 - roadWidth / 2,
    //       0,
    //       roadWidth,
    //       canvas.height
    //     );
    //     ctx.strokeRect(
    //       0,
    //       canvas.height / 2 - roadWidth / 2,
    //       canvas.width,
    //       roadWidth
    //     );
    //     break;
    // }

    // // 如果是主动技能，显示剩余使用次数
    // if (skill.type === "active" && skill.uses !== undefined) {
    //   ctx.fillStyle = "#000";
    //   ctx.font = "12px Arial";
    //   ctx.textAlign = "right";
    //   ctx.textBaseline = "bottom";
    //   ctx.fillText(skill.uses, canvas.width - 2, canvas.height - 2);
    // }

    // // 清除容器中的现有内容
    // container.innerHTML = "";
    // container.appendChild(canvas);
  }

  // 辅助方法：绘制箭头
  drawArrow(ctx, x, y, size, rotation = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    ctx.beginPath();
    ctx.moveTo(-size / 2, 0);
    ctx.lineTo(size / 2, 0);
    ctx.lineTo(size / 4, -size / 4);
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 4, size / 4);
    ctx.stroke();

    ctx.restore();
  }


  equipSkill(skill) {
    if (!skill || !skill.id) return; // 添加安全检查

    // 检查是否有空槽
    let slotIndex = this.skillSlots.findIndex((slot) => slot === null);

    // 如果没有空槽，显示替换选择界面
    if (slotIndex === -1) {
      this.showReplaceSkillDialog(skill);
      return;
    }

    // 确保复制 id
    this.skillSlots[slotIndex] = {
      ...skill,
      id: skill.id,
    };

    // 更新技能槽显示
    this.updateSkillSlots();

    // 关闭选择界面并继续游戏
    document.getElementById("skillSelection").style.display = "none";
    this.skillSelectionActive = false;
    this.lastUpdateTime = Date.now();
    this.isPlaying = true;
    requestAnimationFrame(() => this.gameLoop());
  }

  showReplaceSkillDialog(newSkill) {
    const dialog = document.createElement("div");
    dialog.style.position = "fixed";
    dialog.style.top = "50%";
    dialog.style.left = "50%";
    dialog.style.transform = "translate(-50%, -50%)";
    dialog.style.backgroundColor = "white";
    dialog.style.padding = "20px";
    dialog.style.borderRadius = "10px";
    dialog.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
    dialog.style.zIndex = "1000";

    // 添加提示文本
    const title = document.createElement("div");
    title.textContent = "Replace which skill?";
    title.style.marginBottom = "20px";
    title.style.textAlign = "center";
    dialog.appendChild(title);

    // 创建技能选择按钮
    const buttonContainer = document.createElement("div");
    buttonContainer.style.display = "flex";
    buttonContainer.style.justifyContent = "space-around";
    buttonContainer.style.gap = "10px";

    // 为每个已装备的技能创建选择按钮
    this.skillSlots.forEach((slot, index) => {
      const button = document.createElement("div");
      button.style.cursor = "pointer";
      button.style.padding = "10px";
      button.style.border = "1px solid black";
      button.style.borderRadius = "5px";

      // 创建技能图标容器
      const iconContainer = document.createElement("div");
      iconContainer.style.width = "50px";
      iconContainer.style.height = "50px";
      this.drawSkillIcon(iconContainer, slot);
      button.appendChild(iconContainer);

      // 添加点击事件
      button.onclick = () => {
        this.skillSlots[index] = {
          ...newSkill,
          id: newSkill.id,
        };
        this.updateSkillSlots();
        dialog.remove();

        // 关闭选择界面并继续游戏
        document.getElementById("skillSelection").style.display = "none";
        this.skillSelectionActive = false;
        this.lastUpdateTime = Date.now();
        this.isPlaying = true;
        requestAnimationFrame(() => this.gameLoop());
      };

      buttonContainer.appendChild(button);
    });

    dialog.appendChild(buttonContainer);

    // 添加关闭按钮
    const closeButton = document.createElement("div");
    closeButton.style.position = "absolute";
    closeButton.style.top = "10px";
    closeButton.style.right = "10px";
    closeButton.style.width = "20px";
    closeButton.style.height = "20px";
    closeButton.style.cursor = "pointer";
    closeButton.style.fontSize = "20px";
    closeButton.style.lineHeight = "20px";
    closeButton.style.textAlign = "center";
    closeButton.innerHTML = "×";
    closeButton.onclick = () => {
      dialog.remove();
      // 关闭选择界面并继续游戏
      document.getElementById("skillSelection").style.display = "none";
      this.skillSelectionActive = false;
      this.lastUpdateTime = Date.now();
      this.isPlaying = true;
      requestAnimationFrame(() => this.gameLoop());
    };
    dialog.appendChild(closeButton);

    document.body.appendChild(dialog);
  }

  updateSkillSlots() {
    const slots = document.getElementsByClassName("skill-slot");
    Array.from(slots).forEach((slot, index) => {
      slot.innerHTML = "";
      if (this.skillSlots[index]) {
        this.drawSkillIcon(slot, this.skillSlots[index]);
      }
    });
  }

  useSkill(slotIndex) {
    if (!this.isPlaying || !this.skillSlots[slotIndex]) return;

    const skill = this.skillSlots[slotIndex];

    // 检查特殊关卡技能限制
    if (
      skill.id === "globalLight" &&
      !["fog", "lightning", "breadcrumb"].includes(this.currentSpecialLevel)
    ) {
      return;
    }

    // 使用技能并检查是否生效
    let skillEffective = true;
    if (skill.id === "wallPass") {
      skillEffective = skill.effect();
    } else {
      skill.effect();
    }

    // 如果是主动技能，减少使用次数
    if (skill.type === "active" && skillEffective) {
      skill.uses--;
      if (skill.uses <= 0) {
        this.skillSlots[slotIndex] = null;
      }
      this.updateSkillSlots();
    }
  }

  // 技能效果实现
  useWallPass() {
    // 获取重力方向
    const gravityX = this.ball.acceleration.x;
    const gravityY = this.ball.acceleration.y;
    const magnitude = Math.sqrt(gravityX * gravityX + gravityY * gravityY);

    if (magnitude === 0) return false; // 添加返回值表示技能是否生效

    // 归一化重力向量
    const dirX = gravityX / magnitude;
    const dirY = gravityY / magnitude;

    // 获取当前格子位置
    const currentCellX = Math.floor(this.ball.x / this.cellSize);
    const currentCellY = Math.floor(this.ball.y / this.cellSize);

    // 检查周围的墙壁
    const walls = [
      { dx: 1, dy: 0, angle: 0 }, // 右
      { dx: 0, dy: 1, angle: Math.PI / 2 }, // 下
      { dx: -1, dy: 0, angle: Math.PI }, // 左
      { dx: 0, dy: -1, angle: -Math.PI / 2 }, // 上
    ];

    // 找到与重力方向最接近的墙
    let bestWall = null;
    let bestAngleDiff = Math.PI;
    const gravityAngle = Math.atan2(dirY, dirX);

    walls.forEach((wall) => {
      // 检查这个方向是否有墙
      const wallX = currentCellX + wall.dx;
      const wallY = currentCellY + wall.dy;

      if (
        wallX >= 0 &&
        wallX < this.maze[0].length &&
        wallY >= 0 &&
        wallY < this.maze.length &&
        this.maze[wallY][wallX] === 1
      ) {
        // 计算与重力方向的角度差
        let angleDiff = Math.abs(wall.angle - gravityAngle);
        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

        if (angleDiff < bestAngleDiff) {
          bestAngleDiff = angleDiff;
          bestWall = wall;
        }
      }
    });

    // 如果找到合适的墙
    if (bestWall) {
      // 计算目标位置
      const targetCellX = currentCellX + bestWall.dx * 2;
      const targetCellY = currentCellY + bestWall.dy * 2;

      // 检查目标位置是否有效
      if (
        targetCellX >= 0 &&
        targetCellX < this.maze[0].length &&
        targetCellY >= 0 &&
        targetCellY < this.maze.length &&
        this.maze[targetCellY][targetCellX] === 0
      ) {
        // 目标位置是通道

        // 传送到墙的另一边
        this.ball.x = (targetCellX + 0.5) * this.cellSize;
        this.ball.y = (targetCellY + 0.5) * this.cellSize;
        // 重置速度，避免穿墙后的异常运动
        this.ball.velocity.x = 0;
        this.ball.velocity.y = 0;
        return true; // 技能生效
      }
    }
    return false; // 技能未生效
  }

  useTimeStop() {
    this.activeSkillEffects.timeStopActive = true;
    this.activeSkillEffects.timeStopRemaining = 5000; // 5秒
  }

  useGlobalLight() {
    // 检查是否在可用的特殊关卡中
    if (
      !["fog", "lightning", "breadcrumb"].includes(this.currentSpecialLevel)
    ) {
      return false; // 如果不在特殊关卡中，不允许使用
    }

    // 暂停游戏
    this.isPlaying = false;

    // 保存当前的特殊关卡状态
    const originalSpecialLevel = this.currentSpecialLevel;

    // 临时移除特殊效果以显示完整迷宫
    this.currentSpecialLevel = null;

    // 重新绘制一次以显示完整迷宫
    this.draw();

    // 5秒后恢复游戏
    setTimeout(() => {
      // 恢复特殊关卡效果
      this.currentSpecialLevel = originalSpecialLevel;

      // 重置时间并恢复游戏
      this.lastUpdateTime = Date.now();
      this.isPlaying = true;
      requestAnimationFrame(() => this.gameLoop());
    }, 5000);

    return true; // 技能使用成功
  }

  useTeleport() {
    const currentDist = this.getDistanceToExit(this.ball.x, this.ball.y);
    let newX, newY;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      const randomCell = this.getRandomEmptyCell();
      newX = (randomCell.x + 0.5) * this.cellSize;
      newY = (randomCell.y + 0.5) * this.cellSize;
      attempts++;
    } while (
      this.getDistanceToExit(newX, newY) >= currentDist &&
      attempts < maxAttempts
    );

    if (attempts < maxAttempts) {
      this.ball.x = newX;
      this.ball.y = newY;
    }
  }

  // 辅助方法：获取到终点的距离
  getDistanceToExit(x, y) {
    const exitX = (this.endX + 0.5) * this.cellSize;
    const exitY = (this.endY + 0.5) * this.cellSize;
    return Math.sqrt((x - exitX) * (x - exitX) + (y - exitY) * (y - exitY));
  }

  // 辅助方法：获取随机空白格子
  getRandomEmptyCell() {
    let x, y;
    do {
      x = Math.floor(Math.random() * this.maze[0].length);
      y = Math.floor(Math.random() * this.maze.length);
    } while (this.maze[y][x] !== 0);
    return { x, y };
  }

  hasPassiveSkill(skillId) {
    return this.skillSlots.some((slot) => slot && slot.id === skillId);
  }

  isIntersection(x, y) {
    let pathCount = 0;
    // 检查上下左右四个方向是否有通路
    if (y > 0 && this.maze[y - 1][x] === 0) pathCount++;
    if (y < this.maze.length - 1 && this.maze[y + 1][x] === 0) pathCount++;
    if (x > 0 && this.maze[y][x - 1] === 0) pathCount++;
    if (x < this.maze[0].length - 1 && this.maze[y][x + 1] === 0) pathCount++;
    return pathCount > 2; // 如果有超过两个方向是通路，则认为是交叉路口
  }

  confirmBack() {
    if (confirm("Do you want to return to the start page?")) {
      this.returnToStart();
    }
  }

  returnToStart() {
    // 返回开始界面
    this.startPage.style.display = "flex";
    this.startGameButton.style.display = "block";
    this.modeSelect.style.display = "none";
    document.getElementById("game-container").style.display = "none";
    this.backButton.style.display = "none";

    // 重置游戏状态
    this.isPlaying = false;
    this.resetGameState();
  }

  showEffectEndIndicator() {
    const indicator = document.createElement("div");
    indicator.style.position = "absolute";
    indicator.style.top = "50%";
    indicator.style.left = "50%";
    indicator.style.transform = "translate(-50%, -50%)";
    indicator.style.padding = "10px";
    indicator.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    indicator.style.color = "white";
    indicator.style.borderRadius = "5px";
    indicator.textContent = "Light Effect Ended";
    document.getElementById("game-container").appendChild(indicator);

    setTimeout(() => {
      indicator.style.opacity = "0";
      indicator.style.transition = "opacity 0.3s";
      setTimeout(() => indicator.remove(), 300);
    }, 1000);
  }

  getCurrentLevel() {
    return this.level
  }
}


// 当页面加载完成后初始化游戏
document.addEventListener("DOMContentLoaded", () => {
  let game;

  try {
    game = new MazeGame();

    const levelDiv = document.getElementById("level")
    levelDiv.innerHTML = "LEVEL " + game.getCurrentLevel()
  } catch (error) {
    console.error("Game initialization error:", error);
    // 显示友好的错误提示
    const errorDiv = document.createElement("div");
    errorDiv.style.textAlign = "center";
    errorDiv.style.padding = "20px";
    errorDiv.innerHTML = "游戏加载失败，请在系统浏览器中打开";
    document.body.appendChild(errorDiv);
  }

  const ballContainers = document.querySelectorAll(".ball-container");
  let currentBallIndex = 0;

  ballContainers.forEach((container, index) => {
    container.addEventListener("click", () => {
      // Hide current ball
      ballContainers[currentBallIndex].style.display = "none";

      // Update index to next ball
      currentBallIndex = (currentBallIndex + 1) % ballContainers.length;

      // Show next ball
      ballContainers[currentBallIndex].style.display = "block";
    });
  });

  // Initially show only the first ball
  ballContainers.forEach((container, index) => {
    if (index !== 0) {
      container.style.display = "none";
    }
  });

  const pauseButton = document.getElementById("pause-button")
  const pauseMenu = document.getElementById("pause-menu")
  const resumeButton = document.getElementById("resume-button")
  pauseButton.onclick = () => {
    game.pauseGame()
    pauseMenu.style.display = "block"
  }

  resumeButton.onclick = () => {
    game.resumeGame()
    pauseMenu.style.display = "none"
  }
});
