import { Unraid } from '@ridenui/unraid';
import { SSHExecutor } from '@ridenui/unraid/dist/executors/SSH';
import ping from 'ping';
import { IPingEventSubscriber } from './utils/IPingEventSubscriber';

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

    async systemInfo(){
        const hostname = await this._unraid.system.getHostname();
        const info = await this._unraid.system.info();
        const ram = await this._getRamInfo();
        const cpu = await this._getCpuUsage();
        const array = await this._getArrayInfo();
        const cache = await this._getCacheInfo();
        const uptime = await this._getUptime();
        return {
            hostname: hostname,
            systemInfo: info,
            cpu: cpu,
            ram: ram,
            array: array,
            cache: cache,
            uptime: uptime
        };
    }

    async systemStats(){
        const uptime = await this._getUptime();
        const cpuUsage = await this._getCpuUsage();
        const memoryUsage = await this._unraid.system.loadAverage();
        const ramUsage = await this._getRamInfo();
        const arrayUsage = await this._getArrayInfo();
        const cacheUsage = await this._getCacheInfo();
        const diskUsage = await this._unraid.system.diskfree();
        return {
            uptime: uptime,
            cpuUsage: cpuUsage,
            memoryUsage: memoryUsage,
            arrayUsage: arrayUsage,
            diskUsage: diskUsage,
            cacheUsage: cacheUsage,
            ramUsage: ramUsage
        };
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

    async _getRamInfo(){
        let ramInfo = {
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

    async _getArrayInfo(){
        let arrayInfo = {
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

    async _getCacheInfo(){
        let cacheInfo = {
            total: 0,
            used: 0,
            free: 0,
            percentUsed: 0,
            raw: ''
        }
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

    async _getUptime(){
        const { code, stdout } = await this._executor.executeSSH({
            command: `uptime | awk -F ',' ' {print $1} ' | awk ' {print $3} ' | awk -F ':' ' {hrs=$1; min=$2; print hrs"."min} '`
        });

        const uptime = {
            upSince:  (code === 0) && this._isNumber(stdout[0].trim()) ? Number(stdout[0].trim()) : null,
            uptime: await this._unraid.system.uptime()
        };
        return uptime;
    }

    async _getCpuUsage(){
        const usage = await this._unraid.system.usage();
        return {
            percentIdle: usage.all.idle,
            percentBusy: (100-usage.all.idle),
            usage: usage
        };
    }
}

export { UnraidRemote }