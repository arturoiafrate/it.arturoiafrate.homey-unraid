import { Unraid } from '@ridenui/unraid';
import { SSHExecutor } from '@ridenui/unraid/dist/executors/SSH';
import ping from 'ping';
import { IPingEventSubscriber } from './utils/IPingEventSubscriber';
import { ICPUUsage, IMemoryUsage, ISystemStats, IUptimeExt } from './utils/ISystemStats';
import { CPUUsage } from '@ridenui/unraid/dist/modules/system/extensions/cpu';

class UnraidRemote {
    _url: string;
    _username: string;
    _password: string;
    _port: number;
    _unraid: Unraid;
    _executor: SSHExecutor;

    _isOnline: boolean = false;
    _isOnlineSubscribers: IPingEventSubscriber[] = [];

    constructor(url: string, username: string, password: string, port: number) {
        this._url = url;
        this._username = username;
        this._password = password;
        this._port = port == 0 ? 22 : port;
        this._isOnline = false;

        this._unraid = new Unraid({
            executor: SSHExecutor,
            executorConfig: {
                host: this._url,
                username: this._username,
                password: this._password,
                port: this._port
            },
        });

        this._executor = this._unraid.executor as SSHExecutor;
    }

    subscribeIsUnraidServerOnline(subscriber: IPingEventSubscriber): void {
        this._isOnlineSubscribers.push(subscriber);
    }

    unsubscribeAll(){
        this._isOnlineSubscribers = [];
    }

    async ping(): Promise<boolean> {
        let res = await ping.promise.probe(this._url);
        this._isOnline = (res && res.alive);
        this._isOnlineSubscribers.forEach(subscriber => {
            if(this._isOnline){
                subscriber.isOnlineCallback();
            } else {
                subscriber.isOfflineCallback();
            }
        });
        return this._isOnline;
    }

    get isOnline(): boolean {
        return this._isOnline;
    }

    turnOn(macAddress: String) {
        const wol = require('wol');
        wol.wake(macAddress, function(err: any, res: any){
            //console.log('res:' + res);
            //console.log('err:' + err);
        });
    }
    
    turnOff() {
        this._executor.executeSSH({
            command: 'shutdown -h now'
        });
    }

    async systemInfo() : Promise<ISystemStats>{
        const systemInfo : ISystemStats = {
            cpuUsage: await this._getCpuUsage(),
            uptime: await this._getUptime(),
            arrayUsage: await this._getArrayInfo(),
            cacheUsage: await this._getCacheInfo(),
            ramUsage: await this._getRamInfo()
        };
        return systemInfo;
    }

    async systemStats() : Promise<ISystemStats>{
        let sysStats: ISystemStats = await this.systemInfo();
        sysStats.memoryUsage = await this._unraid.system.loadAverage();
        sysStats.diskUsage = await this._unraid.system.diskfree();  
        return sysStats;
    }

    disconnect() {
        this._executor.disconnect();
    }

    /* Private methods */
    _isNumber(value?: string | number): boolean
    {
       return ((value != null) &&
               (value !== '') &&
               !isNaN(Number(value.toString())));
    }

    _isEmpty(value?: string): boolean{
       return ((value == null) || (value == undefined) || (value === ''));
    }

    async _getRamInfo() : Promise<IMemoryUsage>{
        let ramInfo : IMemoryUsage = {
            total: 0,
            used: 0,
            free: 0,
            percentUsed: 0,
            raw: ''
        };
        const { code, stdout } = await this._executor.executeSSH({
            command: 'free -k | grep Mem'
        });
        if(code === 0 && stdout && stdout.length > 0){
            let infos = stdout[0].trim().split(/\s+/);
            ramInfo.raw = stdout[0].trim();
            ramInfo.total = this._isNumber(infos[1]) ? (Number(infos[1]))/1024000 : 0;
            ramInfo.used = this._isNumber(infos[2]) ? (Number(infos[2])/1024000) : 0;
            ramInfo.free = this._isNumber(infos[3]) ? (Number(infos[3])/1024000) : 0;
            if(ramInfo.used > 0 && ramInfo.total > 0){
                ramInfo.percentUsed = (ramInfo.used/ramInfo.total)*100;
            }
        }
        return ramInfo;
    }

    async _getArrayInfo() : Promise<IMemoryUsage>{
        let arrayInfo : IMemoryUsage = {
            total: 0,
            used: 0,
            free: 0,
            percentUsed: 0,
            raw: ''
        }
        const { code, stdout } = await this._executor.executeSSH({
            command: 'df /mnt/user | grep shfs'
        });
        if(code === 0 && stdout && stdout.length > 0){
            let infos = stdout[0].trim().split(/\s+/);
            arrayInfo.raw = stdout[0].trim();
            arrayInfo.total = this._isNumber(infos[1]) ? (Number(infos[1]))/1024000 : 0;
            arrayInfo.used = this._isNumber(infos[2]) ? (Number(infos[2])/1024000) : 0;
            arrayInfo.free = this._isNumber(infos[3]) ? (Number(infos[3])/1024000) : 0;
            arrayInfo.percentUsed =  !this._isEmpty(infos[4]) ?  Number(infos[4].replace("%","")) : 0;
        }
        return arrayInfo;
    }

    async _getCacheInfo() : Promise<IMemoryUsage>{
        let cacheInfo : IMemoryUsage = {
            raw: '',
            total: 0,
            used: 0,
            free: 0,
            percentUsed: 0
        };
        const { code, stdout } = await this._executor.executeSSH({
            command: 'df /mnt/cache | grep cache'
        });
        if(code === 0 && stdout && stdout.length > 0){
            let infos = stdout[0].trim().split(/\s+/);
            cacheInfo.raw = stdout[0].trim();
            cacheInfo.total = this._isNumber(infos[1]) ? (Number(infos[1]))/1024000 : 0;
            cacheInfo.used = this._isNumber(infos[2]) ? (Number(infos[2])/1024000) : 0;
            cacheInfo.free = this._isNumber(infos[3]) ? (Number(infos[3])/1024000) : 0;
            cacheInfo.percentUsed =  !this._isEmpty(infos[4]) ?  Number(infos[4].replace("%","")) : 0;
        }
        return cacheInfo;
    }

    async _getUptime() : Promise<IUptimeExt>{
        const { code, stdout } = await this._executor.executeSSH({
            command: `awk '{print int($1/3600)"."int(($1%3600)/60)}' /proc/uptime`
        });
        const uptime : IUptimeExt = {
            upSince:  (code === 0) && this._isNumber(stdout[0].trim()) ? Number(stdout[0].trim()) : undefined,
            uptime: await this._unraid.system.uptime()
        }
        return uptime;
    }

    async _getCpuUsage() : Promise<ICPUUsage>{
        const usage : CPUUsage = await this._unraid.system.usage();
        const cpuUsage : ICPUUsage = {
            percentIdle: usage.all.idle,
            percentBusy: (100-usage.all.idle),
            usage: usage
        };
        return cpuUsage;
    }
}

export { UnraidRemote }