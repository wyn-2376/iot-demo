const path = require('path')
const express = require('express')
const mqtt = require('mqtt')

const PORT = process.env.PORT || 3000
const BROKER = 'mqtt://127.0.0.1:1883'
const TOPIC = 'iot/test'
const MAX_POINTS = 150

const history = []
const sseClients = new Set()
let mqttConnected = false

const app = express()
app.use(express.static(path.join(__dirname, 'public')))

app.get('/api/history', function (req, res) {
    res.json(history)
})

app.get('/api/status', function (req, res) {
    res.json({ mqttConnected: mqttConnected, topic: TOPIC, count: history.length })
})

app.get('/api/stream', function (req, res) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    sseClients.add(res)
    res.write(': connected\n\n')

    const heartbeat = setInterval(() => {
        res.write(': ping\n\n')
    }, 25000)

    req.on('close', function () {
        clearInterval(heartbeat)
        sseClients.delete(res)
    })
})

function broadcast(point) {
    const data = `data: ${JSON.stringify(point)}\n\n`
    for (const res of sseClients) {
        res.write(data)
    }
}

const client = mqtt.connect(BROKER)

client.on('connect', function () {
    mqttConnected = true
    console.log("服务端：成功连接MQTT服务器")
    client.subscribe(TOPIC, function (err) {
        if (err) {
            console.error("服务端：订阅失败", err.message)
        } else {
            console.log("服务端：已订阅主题", TOPIC)
        }
    })
})

client.on('message', function (topic, message) {
    let point
    try {
        point = JSON.parse(message.toString())
    } catch (err) {
        console.warn("服务端：忽略非JSON消息", message.toString())
        return
    }

    history.push(point)
    if (history.length > MAX_POINTS) {
        history.shift()
    }
    broadcast(point)
})

client.on('error', function (err) {
    console.error("服务端：MQTT连接错误", err.message)
})

client.on('offline', function () {
    mqttConnected = false
    console.warn("服务端：MQTT连接已断开")
})

client.on('reconnect', function () {
    console.log("服务端：正在重连MQTT服务器")
})

app.listen(PORT, function () {
    console.log(`可视化面板: http://localhost:${PORT}`)
})
