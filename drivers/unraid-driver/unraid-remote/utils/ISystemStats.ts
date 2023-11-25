import { IDiskFreeReturn, ILoadAverage, IUptime } from '@ridenui/unraid/dist/modules/system/extensions';
import { CPUUsage } from '@ridenui/unraid/dist/modules/system/extensions/cpu';

/* CPU Properties */
interface ICPUUsage {
    percentIdle: number;
    percentBusy: number;
    usage: CPUUsage;
}

/* Uptime Properties */

interface IUptimeExt {
    upSince?: number;
    uptime: IUptime;
}

/* Memory Properties */

interface IMemoryUsage {
    raw: string;
    total: number;
    used: number;
    free: number;
    percentUsed: number;
}

interface ISystemStats {
    cpuUsage: ICPUUsage;
    uptime: IUptimeExt;
    arrayUsage: IMemoryUsage;
    cacheUsage: IMemoryUsage;
    ramUsage: IMemoryUsage;
    memoryUsage?: ILoadAverage;
    diskUsage?: IDiskFreeReturn[];
}

interface ISSHCommandOutput {
    code: number;
    stdout?: string;
    stderr?: string;
}

export { ICPUUsage, IUptimeExt, IMemoryUsage, ISystemStats, ISSHCommandOutput };