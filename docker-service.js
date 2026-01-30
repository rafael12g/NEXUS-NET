const Docker = require('dockerode');
const os = require('os');

class DockerService {
    constructor() {
        // Detect platform and use appropriate connection method
        const isWindows = os.platform() === 'win32';
        
        try {
            // Allows custom configuration via environment variables (DOCKER_HOST, DOCKER_PORT, etc.)
            if (process.env.DOCKER_HOST) {
                this.docker = new Docker();
            } else if (isWindows) {
                // Windows: use named pipe for security
                this.docker = new Docker({ socketPath: '//./pipe/docker_engine' });
            } else {
                // Linux/Mac uses Unix socket
                this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
            }
            this.available = true;
        } catch (error) {
            console.warn('Docker not available:', error.message);
            this.available = false;
            this.docker = null;
        }
    }

    async isAvailable() {
        if (!this.available || !this.docker) {
            return false;
        }
        
        try {
            await this.docker.ping();
            return true;
        } catch (error) {
            console.warn('Docker ping failed:', error.message);
            return false;
        }
    }

    async listContainers(all = true) {
        if (!await this.isAvailable()) {
            return { success: false, error: 'Docker not available' };
        }

        try {
            const containers = await this.docker.listContainers({ all });
            return {
                success: true,
                containers: containers.map(c => ({
                    id: c.Id,
                    name: c.Names[0].replace(/^\//, ''),
                    image: c.Image,
                    state: c.State,
                    status: c.Status,
                    created: c.Created,
                    ports: c.Ports
                }))
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getContainerStatus(id) {
        if (!await this.isAvailable()) {
            return { success: false, error: 'Docker not available' };
        }

        try {
            const container = this.docker.getContainer(id);
            const info = await container.inspect();
            
            return {
                success: true,
                status: {
                    id: info.Id,
                    name: info.Name.replace(/^\//, ''),
                    state: info.State.Status,
                    running: info.State.Running,
                    paused: info.State.Paused,
                    restarting: info.State.Restarting,
                    exitCode: info.State.ExitCode,
                    startedAt: info.State.StartedAt,
                    finishedAt: info.State.FinishedAt
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async startContainer(id) {
        if (!await this.isAvailable()) {
            return { success: false, error: 'Docker not available' };
        }

        try {
            const container = this.docker.getContainer(id);
            await container.start();
            return { success: true, message: 'Container started' };
        } catch (error) {
            // If already started, return success
            if (error.statusCode === 304) {
                return { success: true, message: 'Container already started' };
            }
            return { success: false, error: error.message };
        }
    }

    async stopContainer(id) {
        if (!await this.isAvailable()) {
            return { success: false, error: 'Docker not available' };
        }

        try {
            const container = this.docker.getContainer(id);
            await container.stop();
            return { success: true, message: 'Container stopped' };
        } catch (error) {
            // If already stopped, return success
            if (error.statusCode === 304) {
                return { success: true, message: 'Container already stopped' };
            }
            return { success: false, error: error.message };
        }
    }

    async restartContainer(id) {
        if (!await this.isAvailable()) {
            return { success: false, error: 'Docker not available' };
        }

        try {
            const container = this.docker.getContainer(id);
            await container.restart();
            return { success: true, message: 'Container restarted' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async listNetworks() {
        if (!await this.isAvailable()) {
            return { success: false, error: 'Docker not available' };
        }

        try {
            const networks = await this.docker.listNetworks();
            return {
                success: true,
                networks: networks.map(n => ({
                    id: n.Id,
                    name: n.Name,
                    driver: n.Driver,
                    scope: n.Scope,
                    created: n.Created
                }))
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getContainerStats(id) {
        if (!await this.isAvailable()) {
            return { success: false, error: 'Docker not available' };
        }

        try {
            const container = this.docker.getContainer(id);
            const stats = await container.stats({ stream: false });

            const cpuStats = stats.cpu_stats || {};
            const precpuStats = stats.precpu_stats || {};
            const cpuDelta = (cpuStats.cpu_usage?.total_usage || 0) - (precpuStats.cpu_usage?.total_usage || 0);
            const systemDelta = (cpuStats.system_cpu_usage || 0) - (precpuStats.system_cpu_usage || 0);
            const cpuCount = cpuStats.online_cpus || (cpuStats.cpu_usage?.percpu_usage ? cpuStats.cpu_usage.percpu_usage.length : 1);

            let cpuPercent = 0;
            if (systemDelta > 0 && cpuDelta > 0) {
                cpuPercent = (cpuDelta / systemDelta) * cpuCount * 100;
            }

            const memUsage = stats.memory_stats?.usage || 0;
            const memLimit = stats.memory_stats?.limit || 0;
            const memPercent = memLimit > 0 ? (memUsage / memLimit) * 100 : 0;

            return {
                success: true,
                stats: {
                    cpuPercent,
                    memPercent,
                    memUsageMB: memUsage / (1024 * 1024),
                    memLimitMB: memLimit / (1024 * 1024)
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = DockerService;
