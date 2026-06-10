'use strict';

const os = require('os');
const Docker = require('dockerode');
const config = require('../config');

const PING_CACHE_MS = 5000;

class DockerService {
    constructor() {
        this.docker = null;
        this._lastPing = 0;
        this._lastPingOk = false;

        if (!config.docker.enabled) {
            console.log('[docker] Désactivé via DOCKER_ENABLED=false');
            return;
        }

        try {
            if (config.docker.socketPath) {
                this.docker = new Docker({ socketPath: config.docker.socketPath });
            } else if (process.env.DOCKER_HOST) {
                this.docker = new Docker(); // dockerode reads DOCKER_HOST itself
            } else if (os.platform() === 'win32') {
                this.docker = new Docker({ socketPath: '//./pipe/docker_engine' });
            } else {
                this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
            }
        } catch (err) {
            console.warn('[docker] Initialisation impossible :', err.message);
            this.docker = null;
        }
    }

    async isAvailable() {
        if (!this.docker) return false;
        const now = Date.now();
        if (now - this._lastPing < PING_CACHE_MS) return this._lastPingOk;

        try {
            await this.docker.ping();
            this._lastPingOk = true;
        } catch (err) {
            this._lastPingOk = false;
        }
        this._lastPing = now;
        return this._lastPingOk;
    }

    async _guard() {
        if (!await this.isAvailable()) {
            const err = new Error('Docker non disponible');
            err.expose = true;
            throw err;
        }
    }

    async listContainers(all = true) {
        await this._guard();
        const containers = await this.docker.listContainers({ all });
        return containers.map((c) => ({
            id: c.Id,
            name: (c.Names && c.Names[0] ? c.Names[0] : '').replace(/^\//, ''),
            image: c.Image,
            state: c.State,
            status: c.Status,
            created: c.Created,
            ports: c.Ports
        }));
    }

    async getContainerStatus(id) {
        await this._guard();
        const info = await this.docker.getContainer(id).inspect();
        return {
            id: info.Id,
            name: (info.Name || '').replace(/^\//, ''),
            state: info.State.Status,
            running: info.State.Running,
            paused: info.State.Paused,
            restarting: info.State.Restarting,
            exitCode: info.State.ExitCode,
            startedAt: info.State.StartedAt,
            finishedAt: info.State.FinishedAt
        };
    }

    async startContainer(id) {
        await this._guard();
        try {
            await this.docker.getContainer(id).start();
            return 'Container démarré';
        } catch (err) {
            if (err.statusCode === 304) return 'Container déjà démarré';
            throw err;
        }
    }

    async stopContainer(id) {
        await this._guard();
        try {
            await this.docker.getContainer(id).stop();
            return 'Container arrêté';
        } catch (err) {
            if (err.statusCode === 304) return 'Container déjà arrêté';
            throw err;
        }
    }

    async restartContainer(id) {
        await this._guard();
        await this.docker.getContainer(id).restart();
        return 'Container redémarré';
    }

    async listNetworks() {
        await this._guard();
        const networks = await this.docker.listNetworks();
        return networks.map((n) => ({
            id: n.Id,
            name: n.Name,
            driver: n.Driver,
            scope: n.Scope,
            created: n.Created
        }));
    }

    async getContainerStats(id) {
        await this._guard();
        const stats = await this.docker.getContainer(id).stats({ stream: false });

        const cpu = stats.cpu_stats || {};
        const precpu = stats.precpu_stats || {};
        const cpuDelta = (cpu.cpu_usage?.total_usage || 0) - (precpu.cpu_usage?.total_usage || 0);
        const systemDelta = (cpu.system_cpu_usage || 0) - (precpu.system_cpu_usage || 0);
        const cpuCount = cpu.online_cpus || cpu.cpu_usage?.percpu_usage?.length || 1;

        const cpuPercent = systemDelta > 0 && cpuDelta > 0
            ? (cpuDelta / systemDelta) * cpuCount * 100
            : 0;

        const memUsage = stats.memory_stats?.usage || 0;
        const memLimit = stats.memory_stats?.limit || 0;

        return {
            cpuPercent,
            memPercent: memLimit > 0 ? (memUsage / memLimit) * 100 : 0,
            memUsageMB: memUsage / (1024 * 1024),
            memLimitMB: memLimit / (1024 * 1024)
        };
    }
}

module.exports = new DockerService();
