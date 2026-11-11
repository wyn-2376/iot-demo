const MAX_CHART_POINTS = 60
const MAX_FEED_ITEMS = 10

const tempEl = document.getElementById('temp-value')
const humidityEl = document.getElementById('humidity-value')
const countEl = document.getElementById('count-value')
const feedEl = document.getElementById('feed')
const statusDot = document.getElementById('status-dot')
const statusText = document.getElementById('status-text')

let messageCount = 0
let hasData = false
let chart = null

function setStatus(type, text) {
    statusDot.className = 'dot' + (type ? ' ' + type : '')
    statusText.textContent = text
}

if (typeof window.Chart === 'undefined') {
    document.getElementById('chart').hidden = true
    document.getElementById('chart-fallback').hidden = false
} else {
    chart = new Chart(document.getElementById('chart'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: '温度 (℃)',
                    data: [],
                    yAxisID: 'y',
                    borderColor: '#38bdf8',
                    backgroundColor: 'rgba(56, 189, 248, 0.15)',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 0,
                    fill: true
                },
                {
                    label: '湿度 (%)',
                    data: [],
                    yAxisID: 'y1',
                    borderColor: '#f472b6',
                    backgroundColor: 'rgba(244, 114, 182, 0.12)',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 0,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: {
                    labels: { color: '#cbd5e1', boxWidth: 12, boxHeight: 12 }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.92)',
                    borderColor: 'rgba(148, 163, 184, 0.3)',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    ticks: { color: '#94a3b8', maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
                    grid: { color: 'rgba(148, 163, 184, 0.12)' }
                },
                y: {
                    position: 'left',
                    title: { display: true, text: '温度 (℃)', color: '#38bdf8' },
                    ticks: { color: '#94a3b8' },
                    grid: { color: 'rgba(148, 163, 184, 0.12)' }
                },
                y1: {
                    position: 'right',
                    title: { display: true, text: '湿度 (%)', color: '#f472b6' },
                    ticks: { color: '#94a3b8' },
                    grid: { drawOnChartArea: false }
                }
            }
        }
    })
}

function formatTime(ts) {
    return new Date(ts || Date.now()).toLocaleTimeString()
}

function prependFeed(point) {
    const empty = feedEl.querySelector('.empty')
    if (empty) {
        empty.remove()
    }

    const li = document.createElement('li')
    const time = document.createElement('span')
    time.className = 'time'
    time.textContent = formatTime(point.ts)

    const temp = document.createElement('span')
    temp.className = 'temp'
    temp.textContent = '温度 ' + (typeof point.temperature === 'number' ? point.temperature.toFixed(2) : '--') + ' ℃'

    const humidity = document.createElement('span')
    humidity.className = 'humidity'
    humidity.textContent = '湿度 ' + (typeof point.humidity === 'number' ? point.humidity.toFixed(2) : '--') + ' %'

    li.appendChild(time)
    li.appendChild(temp)
    li.appendChild(humidity)
    feedEl.prepend(li)

    while (feedEl.children.length > MAX_FEED_ITEMS) {
        feedEl.lastElementChild.remove()
    }
}

function addPoint(point) {
    hasData = true
    messageCount += 1
    countEl.textContent = messageCount

    if (typeof point.temperature === 'number') {
        tempEl.textContent = point.temperature.toFixed(1)
    }
    if (typeof point.humidity === 'number') {
        humidityEl.textContent = point.humidity.toFixed(1)
    }

    if (chart) {
        chart.data.labels.push(formatTime(point.ts))
        chart.data.datasets[0].data.push(point.temperature)
        chart.data.datasets[1].data.push(point.humidity)

        while (chart.data.labels.length > MAX_CHART_POINTS) {
            chart.data.labels.shift()
            chart.data.datasets[0].data.shift()
            chart.data.datasets[1].data.shift()
        }
        chart.update('none')
    }

    prependFeed(point)
}

async function init() {
    setStatus('', '正在连接…')

    try {
        const res = await fetch('/api/history')
        const history = await res.json()
        history.forEach(addPoint)
    } catch (err) {
        console.warn('历史数据加载失败', err)
    }

    try {
        const res = await fetch('/api/status')
        const status = await res.json()
        if (!status.mqttConnected && !hasData) {
            setStatus('', 'MQTT 未连接，等待 Broker…')
        }
    } catch (err) {
        console.warn('状态查询失败', err)
    }

    if (hasData) {
        setStatus('ok', '已连接')
    }

    const es = new EventSource('/api/stream')

    es.onopen = function () {
        if (!hasData) {
            setStatus('', '已连接，等待数据…')
        }
    }

    es.onmessage = function (event) {
        let point
        try {
            point = JSON.parse(event.data)
        } catch (err) {
            return
        }
        addPoint(point)
        setStatus('ok', '已连接')
    }

    es.onerror = function () {
        setStatus('bad', '连接已断开，正在重连…')
    }
}

init()
