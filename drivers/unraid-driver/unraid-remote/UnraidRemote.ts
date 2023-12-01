import { Unraid } from '@ridenui/unraid';
import { SSHExecutor } from '@ridenui/unraid/dist/executors/SSH';
import { probe } from '@network-utils/tcp-ping';
import { IPingEventSubscriber } from './utils/IPingEventSubscriber';
import { ICPUUsage, IMemoryUsage, ISSHCommandOutput, ISystemStats, IUptimeExt } from './utils/ISystemStats';
import { CPUUsage } from '@ridenui/unraid/dist/modules/system/extensions/cpu';
import { IExecuteResult } from '@ridenui/unraid/dist/instance/executor';
import { Container } from './utils/IDockerContainer';

class UnraidRemote {
    private _url: string;
    private _username: string;
    private _password: string;
    private _port: number;
    private _unraid: Unraid;
    private _executor: SSHExecutor;

    private _isOnline: boolean = false;
    private _isOnlineSubscribers: IPingEventSubscriber[] = [];

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

    static async testConnection(url: string, port: number): Promise<boolean>{

        try{
            const isOnline = await probe(port, url, 3000);
            return isOnline;
        } catch(error){
            return false;
        }
    }

    static async testSSHConnection(url: string, port: number, username: string, password: string): Promise<boolean>{
        const executor = new SSHExecutor({
            host: url,
            username: username,
            password: password,
            port: port
        });
        try{
            const { code } = await executor.execute({
                command: 'echo "Hello World"'
            });
            executor.disconnect();
            return code === 0;
        } catch(error){
            return false;
        }
    }

    async ping(): Promise<boolean> {
        try{
            this._isOnline = await probe(this._port, this._url, 3000);
            this._isOnlineSubscribers.forEach(subscriber => {
                if(this._isOnline){
                    subscriber.isOnlineCallback();
                } else {
                    subscriber.isOfflineCallback();
                }
            });
        } catch(error){
            this._isOnline = false
        }
        return this._isOnline;
    }

    get isOnline(): boolean {
        return this._isOnline;
    }

    turnOn(macAddress: String): boolean {
        const wol = require('wol');
        try{
            return wol.wake(macAddress, function(err: any, res: any){
                if(err) Promise.resolve (false);
                return Promise.resolve(true);
            });
        } catch(error){
            return false;
        }
    }
    
    turnOff(): boolean {
        try{
            this._executor.executeSSH({
                command: 'shutdown -h now'
            });
            return true;
        } catch(error){
            return false;
        }
        
    }

    executeShellCommandNoWait(command: string) : boolean {
        try{
            this._executor.executeSSH({
                command: command
            });
            return true;
        } catch(error){
            return false;
        }
    }

    async executeShellCommand(command: string): Promise<ISSHCommandOutput>{
        let out : ISSHCommandOutput = {
            code: -999,
            stdout: '',
            stderr: ''
        }
        try{
            const result : IExecuteResult = await this._executor.executeSSH({
                command: command
            });
            out.code = result.code;
            out.stdout = result.stdout ? result.stdout.join(';') : '';
            out.stderr = result.stderr ? result.stderr.join(';') : ''
        } catch (error) {
            out.code = -996;
            out.stderr = 'Exception occured while executing command';
        }
        
        return out;
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

    async containerList() : Promise<Container[]>{
        let containers : Container[] = [];
        const { code, stdout, stderr } = await this._executor.executeSSH({
            command: `docker ps -a --no-trunc --format '{{.ID}};{{.Names}};{{.Status}};'`
        });
        if(code === 0 && stdout && stdout.length > 0){
            for(let i = 0; i < stdout.length; i++){
                let infos = stdout[i].trim().split(';');
                let container : Container = {
                    id: infos[0],
                    name: infos[1],
                    status: infos[2]
                }
                containers.push(container);
            }
        }
        return containers;
    }

    async isContainerRunning(containerId: string) : Promise<boolean>{
        const { code, stdout, stderr } = await this._executor.executeSSH({
            command: `docker ps --no-trunc --quiet | grep ${containerId}`
        });
        if(code === 0 && stdout && stdout.length > 0){
            if(stdout[0].trim() === containerId){
                return true;
            }
        }
        return false;
    }

    async startContainer(containerId: string) : Promise<boolean>{
        const { code, stdout, stderr } = await this._executor.executeSSH({
            command: `docker start ${containerId}`
        });
        return code === 0;
    }

    async stopContainer(containerId: string) : Promise<boolean>{
        const { code, stdout, stderr } = await this._executor.executeSSH({
            command: `docker stop ${containerId}`
        });
        return code === 0;
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
            percentIdle: Math.round(usage.all.idle * 100) / 100,
            percentBusy: Math.round((100-usage.all.idle) * 100) / 100,
            usage: usage
        };
        return cpuUsage;
    }
}

export { UnraidRemote }