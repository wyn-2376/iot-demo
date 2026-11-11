# mqtt_demo
物联网设计与创新课程实践项目。

## 功能简介
- `publisher.js`：每 2 秒向主题 `iot/test` 发布 JSON 遥测（deviceId / temperature / humidity / ts）。
- `subscriber.js`：订阅 `iot/test` 并打印收到的消息。
- `server.js`：Express 服务，订阅 MQTT 并通过 SSE 向网页实时推送数据。
- `public/`：可视化面板（Chart.js 双轴折线图、最新值卡片、消息流水），Chart.js 已本地化到 `public/vendor/`，无需联网。

## 前置条件
本地 MQTT Broker 运行在 `mqtt://127.0.0.1:1883`（如 Mosquitto、EMQX）。

## 运行方式
```bash
npm install express          # 首次运行安装依赖
node server.js               # 启动可视化服务，默认 http://localhost:3000
node publisher.js            # 另开终端启动发布者
node subscriber.js           # 可选：另开终端启动订阅者
```

浏览器访问 `http://localhost:3000` 查看实时曲线。端口可通过 `PORT` 环境变量修改。

也可使用脚本：`npm start`、`npm run publisher`、`npm run subscriber`。

## 接口
- `GET /api/history`：最近 150 条遥测数据
- `GET /api/status`：MQTT 连接状态与消息总数
- `GET /api/stream`：SSE 实时数据流
