const mqtt = require('mqtt')
const client = mqtt.connect('mqtt://127.0.0.1:1883')

client.on('connect', function () {
    console.log("订阅者：成功连接MQTT服务器")
    client.subscribe("iot/test")
})
client.on('message', function (topic, message) {
    console.log(`收到主题【${topic}】消息：${message.toString()}`)
})