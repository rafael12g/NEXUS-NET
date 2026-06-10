'use strict';

const si = require('systeminformation');

function clampPercent(value) {
    if (!Number.isFinite(value)) return null;
    return Math.max(0, Math.min(100, value));
}

function pickWifiInterface(interfaces) {
    if (!Array.isArray(interfaces)) return null;
    return interfaces.find((i) => i.operstate === 'up' && i.type === 'wireless')
        || interfaces.find((i) => i.operstate === 'up' && /wi-?fi|wlan|wireless/i.test(i.iface || i.ifaceName || ''))
        || interfaces.find((i) => i.type === 'wireless')
        || null;
}

async function getStats() {
    const [load, mem, interfaces] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.networkInterfaces()
    ]);

    let wifi = null;
    const wifiInterface = pickWifiInterface(interfaces);

    if (wifiInterface && (wifiInterface.iface || wifiInterface.ifaceName)) {
        const ifaceName = wifiInterface.iface || wifiInterface.ifaceName;
        const statsList = await si.networkStats(ifaceName);
        const stats = Array.isArray(statsList) ? statsList[0] : null;
        const speedMbps = Number(wifiInterface.speed) || 0;

        let utilizationPercent = null;
        if (stats && speedMbps > 0) {
            const totalBitsPerSec = (Number(stats.rx_sec || 0) + Number(stats.tx_sec || 0)) * 8;
            utilizationPercent = clampPercent((totalBitsPerSec / (speedMbps * 1_000_000)) * 100);
        }

        wifi = {
            iface: ifaceName,
            rxKbps: stats ? Math.round((Number(stats.rx_sec || 0) * 8) / 1000) : null,
            txKbps: stats ? Math.round((Number(stats.tx_sec || 0) * 8) / 1000) : null,
            utilizationPercent
        };
    }

    return {
        cpuPercent: clampPercent(load.currentLoad),
        ramPercent: clampPercent((mem.used / mem.total) * 100),
        wifi
    };
}

module.exports = { getStats };
