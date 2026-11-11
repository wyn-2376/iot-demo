const mqtt = require('mqtt')
const client = mqtt.connect('mqtt://127.0.0.1:1883')

let temperature = 24.0
let humidity = 55.0

client.on('connect', function () {
    console.log("发布者：成功连接MQTT服务器")
    setInterval(() => {
        temperature = +(temperature + (Math.random() - 0.5) * 0.8).toFixed(2)
        humidity = +(humidity + (Math.random() - 0.5) * 2.5).toFixed(2)
        if (temperature < 18) temperature = 18
        if (temperature > 32) temperature = 32
        if (humidity < 30) humidity = 30
        if (humidity > 80) humidity = 80

        const payload = {
            deviceId: "sensor-01",
            temperature: temperature,
            humidity: humidity,
            ts: Date.now()
        }
        const msg = JSON.stringify(payload)
        client.publish("iot/test", msg)
        console.log("发布消息：", msg)
    }, 2000)
})

client.on('error', (err) => console.error("发布者：MQTT连接错误", err.message))
