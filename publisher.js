const mqtt = require('mqtt')
const client = mqtt.connect('mqtt://127.0.0.1:1883')

client.on('connect', function () {
    console.log("发布者：成功连接MQTT服务器")
    setInterval(()=>{
        const msg = `物联网测试消息 ${new Date().toLocaleTimeString()}`
        client.publish("iot/test",msg)
        console.log("发布消息：",msg)
    },2000)
})