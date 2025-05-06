export class Ball {
  constructor(name) {
    this.x = 0;
    this.y = 0;
    this.radius = 10;
    this.velocity = { x: 0, y: 0 };
    this.acceleration = { x: 0, y: 0 };
    this.type = "normal";

    this.types = {
      normal: {
        radius: 10,
        mass: 1,
        sensitivity: 1,
        color: "#000",
      },
      heavy: {
        radius: 11.5, // 大15%
        mass: 1.15, // 重15%
        sensitivity: 0.6, // 对重力感应反应更慢30%（原来20%+新增10%）
        color: "#333",
      },
      light: {
        radius: 5, // 直径是默认的一半
        mass: 0.5,
        sensitivity: 1.2, // 对重力感应反应更快
        color: "#666",
      },
    };
  }

  reset(cellSize) {
    // 将小球放置在起点位置
    this.x = 1.5 * cellSize;
    this.y = 1.5 * cellSize;
    this.velocity = { x: 0, y: 0 };
    this.acceleration = { x: 0, y: 0 };
    // 应用选中的小球类型
    const ballType = this.types[this.type];
    this.radius = ballType.radius;
    this.mass = ballType.mass;
    this.color = ballType.color;
  }

  updateVelocity() {
    // 更新速度
    this.velocity.x += this.acceleration.x;
    this.velocity.y += this.acceleration.y;

    // 限制速度
    const maxSpeed = 5; // 设置最大速度
    const speed = Math.sqrt(
      this.velocity.x ** 2 + this.velocity.y ** 2
    );
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      this.velocity.x *= scale;
      this.velocity.y *= scale;
    }
  }

  updatePosition(speedMultiplier) {
    // 应用速度修改
    this.velocity.x *= speedMultiplier;
    this.velocity.y *= speedMultiplier;

    // 更新位置
    this.x += this.velocity.x;
    this.y += this.velocity.y;
  }
}
