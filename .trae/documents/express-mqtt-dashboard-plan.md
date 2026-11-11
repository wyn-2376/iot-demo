# 为 MQTT Demo 增加 Express 数据可视化网页

## 一、目标摘要

在现有 `publisher.js` / `subscriber.js` 的 MQTT 收发 Demo 基础上，新增一个 Express 服务：

- `publisher.js` 改为发布 **JSON 数值遥测**（温度、湿度、时间戳）；
- `server.js` 用 Express 提供静态页面 + REST 历史数据 + **SSE 实时推送**；
- 浏览器端用 **Chart.js（CDN）** 绘制温度/湿度实时折线图，并展示最新值卡片、消息流水与连接状态。

保持原 MQTT 主题 `iot/test`、Broker `mqtt://127.0.0.1:1883`、2 秒发布间隔不变。

## 二、现状分析

| 文件 | 现状 |
|---|---|
| [package.json](file:///c:/Users/23765/Desktop/mqtt_demo/package.json) | 仅依赖 `mqtt@^5.16.0`；`type: commonjs`；`main` 指向不存在的 `index.js`；`scripts` 只有占位 `test`。**已确认 `node_modules/express` 不存在，需要安装 express。** |
| [publisher.js](file:///c:/Users/23765/Desktop/mqtt_demo/publisher.js) | 连接 Broker 后每 2000ms 向 `iot/test` 发布字符串 `物联网测试消息 <时间>`，无 error 监听。 |
| [subscriber.js](file:///c:/Users/23765/Desktop/mqtt_demo/subscriber.js) | 订阅 `iot/test` 并打印消息。改为 JSON 后仍能正常打印（打印 JSON 文本），**本次不改动**。 |
| [README.md](file:///c:/Users/23765/Desktop/mqtt_demo/README.md) | 仅有项目状态占位，写明"后续补充功能说明、运行方式"。 |
| `node_modules/mqtt` | 版本 5.16.0，支持 `connect / subscribe / publish / on('message')`，满足服务端订阅需要。 |

无现有 Web 目录、无 `.env`、无服务端代码，需从零新增。

## 三、架构与数据流

```
publisher.js ──publish JSON──> MQTT Broker(127.0.0.1:1883) ──topic iot/test──> server.js
                                                                                 │
                            Express :3000 ── GET /            ──> public/index.html
                                          ── GET /api/history ──> 最近 N 条历史
                                          ── GET /api/stream  ──> SSE 实时推送
                                                                                 │
                                                                     浏览器 Chart.js 折线图
```

- 服务端内存环形缓冲保存最近 **150** 条（约 5 分钟），无持久化。
- SSE 每条事件格式：`data: {"deviceId":"sensor-01","temperature":24.53,"humidity":55.21,"ts":1730000000000}\n\n`
- 端口默认 **3000**，可用 `PORT` 环境变量覆盖。

## 四、改动清单

### 1. `package.json`（修改）

- `dependencies` 增加 `"express": "^4.21.2"`（选择 Express 4，与 CommonJS 写法最稳）。
- `scripts` 增加：
  - `"start": "node server.js"`
  - `"publisher": "node publisher.js"`
  - `"subscriber": "node subscriber.js"`
  - 保留原 `test`。
- `main` 改为 `server.js`。

### 2. `publisher.js`（修改）

保持连接逻辑与 2 秒定时器，消息体改为 JSON 遥测，并补充错误监听：

```js
const mqtt = require('mqtt')
const client = mqtt.connect('mqtt://127.0.0.1:1883')

let temperature = 24.0
let humidity = 55.0

client.on('connect', function () {
    console.log("发布者：成功连接MQTT服务器")
    setInterval(() => {
        temperature = +(temperature + (Math.random() - 0.5) * 0.8).toFixed(2)   // 24±，缓慢随机游走
        humidity = +(humidity + (Math.random() - 0.5) * 2.5).toFixed(2)          // 55±
        if (temperature < 18) temperature = 18; if (temperature > 32) temperature = 32
        if (humidity < 30) humidity = 30; if (humidity > 80) humidity = 80

        const payload = {
            deviceId: "sensor-01",
            temperature,
            humidity,
            ts: Date.now()
        }
        const msg = JSON.stringify(payload)
        client.publish("iot/test", msg)
        console.log("发布消息：", msg)
    }, 2000)
})

client.on('error', (err) => console.error("发布者：MQTT连接错误", err.message))
```

说明：`subscriber.js` 无需改动，`message.toString()` 会打印 JSON 字符串。

### 3. `server.js`（新增）

职责：启动 Express、订阅 MQTT、维护历史、提供三个路由。

- 依赖：`express`、`mqtt`、`path`。
- 常量：`PORT = process.env.PORT || 3000`、`TOPIC = 'iot/test'`、`BROKER = 'mqtt://127.0.0.1:1883'`、`MAX_POINTS = 150`。
- 状态：`const history = []`（超出 `MAX_POINTS` 时 `shift()`）、`const sseClients = new Set()`。
- MQTT：连接 Broker，`connect` 时 `subscribe(TOPIC)`；`message` 时 `JSON.parse`，失败则忽略并打日志；成功则入缓冲并向所有 SSE 客户端写 `data: ...\n\n`；监听 `error` / `offline` / `reconnect` 并打印状态。
- SSE：`GET /api/stream` 设置 `Content-Type: text/event-stream`、`Cache-Control: no-cache`、`Connection: keep-alive`，加入集合；每 25 秒写心跳 `: ping\n\n` 防止代理断开；`req.on('close')` 时移除并清理定时器。
- 路由：
  - `GET /api/history` → `res.json(history)`
  - `GET /api/status` → `{ mqttConnected: boolean, topic, count: history.length }`（前端状态灯用；也可由 SSE 心跳推断，但独立接口更直接）
  - 静态目录 `express.static(path.join(__dirname, 'public'))`，`GET /` 返回 `public/index.html`。
- 启动后控制台输出 `可视化面板: http://localhost:3000`。

### 4. `public/index.html`（新增）

- 暗色仪表盘布局：顶部标题 + 连接状态圆点（已连接 / 等待数据）。
- 三个数据卡片：最新温度（℃）、最新湿度（%）、累计消息数。
- 主图：`<canvas id="chart">` 双 Y 轴折线图（温度左轴、湿度右轴），显示最近 60 个点。
- 底部：最近 10 条消息流水列表（时间 + 温度 + 湿度）。
- 引入 Chart.js：`https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js`。
- 引入 `style.css` 与 `app.js`（`defer`）。

### 5. `public/style.css`（新增）

纯 CSS 暗色主题：`body` 深色背景、卡片使用半透明面板 + 圆角 + 细边框、状态点用 `green/amber` 区分、移动端窄屏时网格单列、图表容器固定高度（约 340px）。

### 6. `public/app.js`（新增）

- 初始化 Chart 实例（`type: 'line'`，`animation: false`，`tension: 0.3`，温度数据集 #38bdf8，湿度数据集 #f472b6）。
- 启动时 `fetch('/api/history')` 回填图表与计数；若失败则仅提示。
- `const es = new EventSource('/api/stream')`：`onmessage` 解析 JSON → push 图表（超过 60 点移除最旧）→ 更新卡片、消息列表、状态为"已连接"。
- `es.onerror`：状态改为"连接已断开，正在重连…"（EventSource 浏览器会自动重连，无需额外逻辑）。
- **降级**：若 `!window.Chart`（CDN 不可达），在图表区域显示"图表库加载失败（需联网加载 Chart.js），数值卡片与消息流仍可用"，不影响其余功能。
- 时间显示：`new Date(ts).toLocaleTimeString()`。

### 7. `README.md`（修改，少量）

把"当前状态"替换/补充为：

- 功能简介（MQTT 发布订阅 + Express 可视化面板）
- 运行方式：`npm install express` → 确保 Broker 运行 → `node server.js` → 另开终端 `node publisher.js` → 访问 `http://localhost:3000`
- 依赖与前置条件说明（需本地 MQTT Broker，监听 1883）

## 五、假设与决策

| 决策点 | 结论 |
|---|---|
| 消息格式 | 改为 JSON（用户已确认），字段 `deviceId / temperature / humidity / ts` |
| 数据通路 | 服务端订阅 MQTT + SSE（用户已确认），`publisher.js` 不参与 HTTP，保持解耦 |
| 图库 | Chart.js 4.4.1 CDN（用户已确认），并做加载失败降级 |
| 依赖安装 | 需要执行 `npm install express`（当前未安装）；**实现阶段由我执行**，不新增其他依赖 |
| 主题/端口/间隔 | 均沿用现有硬编码：`iot/test`、1883、2000ms |
| MQTT Broker | 假设本机已运行；未运行时面板显示等待/未连接状态，不报错退出 |
| 持久化 | 不做数据库，内存缓冲，重启清空 |
| 是否改 subscriber.js | 不改 |
| 是否需要构建工具 | 不用，原生 HTML/CSS/JS，直接静态托管 |

## 六、验证步骤

1. 安装依赖：`npm install express`（确认 `node_modules/express` 存在）。
2. 前置：确认本地 MQTT Broker 在 `127.0.0.1:1883` 运行。
3. 启动服务：`node server.js`，控制台应输出 `可视化面板: http://localhost:3000`，MQTT 连接成功后打印已连接。
4. 启动发布：另开终端 `node publisher.js`，应每 2 秒打印 JSON 消息。
5. 浏览器打开 `http://localhost:3000`：
   - 状态灯变为已连接；
   - 温度/湿度折线图每 2 秒新增一个点，双轴刻度合理；
   - 最新值卡片、累计消息数、消息流水同步更新；
   - 刷新页面后图表能通过 `/api/history` 立即回填历史数据。
6. 接口自检：`curl http://localhost:3000/api/history` 返回 JSON 数组；`curl -N http://localhost:3000/api/stream` 持续输出 `data:` 事件。
7. 异常路径：关闭 Broker 后启动 `server.js`，页面仍可打开并显示"等待数据"，进程不崩溃；重启 Broker 后自动重连并恢复推送。
8. 回归：`node subscriber.js` 仍能打印 JSON 消息，原有订阅链路正常。
9. 断网/离线检查：临时屏蔽 CDN 时，页面显示图表库加载失败提示，卡片与消息流仍工作。
