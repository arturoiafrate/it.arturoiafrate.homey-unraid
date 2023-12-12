import { Unraid } from '@ridenui/unraid';
import { SSHExecutor } from '@ridenui/unraid/dist/executors/SSH';
import { probe } from '@network-utils/tcp-ping';
import { IPingEventSubscriber } from './utils/IPingEventSubscriber';
import { ICPUUsage, IMemoryUsage, ISSHCommandOutput, ISystemStats, IUptimeExt } from './utils/ISystemStats';
import { CPUUsage } from '@ridenui/unraid/dist/modules/system/extensions/cpu';
import { IExecuteResult } from '@ridenui/unraid/dist/instance/executor';
import { Container } from './utils/IDockerContainer';
import { UserScript as US } from '@ridenui/unraid/dist/modules/unraid/extensions/userscripts/user-script';
import { UserScript } from './utils/IUserScript';
import { VirtualMachine } from './utils/IVirtualMachine';
import { IVMRebootModes, IVMShutdownModes, VMState } from '@ridenui/unraid/dist/modules/vms/vm';

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
        try{
            sysStats.memoryUsage = await this._unraid.system.loadAverage();
        } catch (error){
            //nothing
        }
        try{
            sysStats.diskUsage = await this._unraid.system.diskfree();
        } catch (error){
            //nothing
        }
        return sysStats;
    }

    async containerList() : Promise<Container[]>{
        let containers : Container[] = [];
        try{
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
        } catch(error){
            //nothing
        }
        return containers;
    }

    async isContainerRunning(containerId: string) : Promise<boolean>{
        try{
            const { code, stdout, stderr } = await this._executor.executeSSH({
                command: `docker ps --no-trunc --quiet | grep ${containerId}`
            });
            if(code === 0 && stdout && stdout.length > 0){
                if(stdout[0].trim() === containerId){
                    return true;
                }
            }
        } catch(error){
            //nothing
        }
        return false;
    }

    async startContainer(containerId: string) : Promise<boolean>{
        try{
            const { code, stdout, stderr } = await this._executor.executeSSH({
                command: `docker start ${containerId}`
            });
            return code === 0;
        } catch(error){
            return false;
        }     
    }

    async stopContainer(containerId: string) : Promise<boolean>{
        try{
            const { code, stdout, stderr } = await this._executor.executeSSH({
                command: `docker stop ${containerId}`
            });
            return code === 0;
        } catch(error){
            return false;
        }
    }

    async isUserScriptsAvailable(): Promise<boolean> {
        try{
            return this._unraid.unraid.hasUserScriptsInstalled();
        } catch (error){
            return false;
        }
    }

    async getAllVMs(): Promise<VirtualMachine[]> {
        let vms : VirtualMachine[] = [];
        try{
            let vmList = await this._unraid.vm.list();
            if(vmList && vmList.length > 0){
                vmList.map(vm => {
                    let virtualMachine : VirtualMachine = {
                        name: vm.name,
                        id: vm.id,
                        state: vm.state
                    }
                    vms.push(virtualMachine);
                });
            }
        }catch(error){
            //nothing
        }
        return vms;
    }

    async getVMStatus(vmName: string): Promise<VMState | undefined >{
        try{
            let vmList = await this._unraid.vm.list();
            if(vmList && vmList.length > 0){
                let vm = vmList.find(vm => vm.name === vmName);
                if(vm){
                    return vm.state;
                }
            }
        }catch(error){
            //nothing
        }
    }

    async startOrResumeVM(vmName: string): Promise<boolean>{
        try{
            let vmList = await this._unraid.vm.list();
            if(vmList && vmList.length > 0){
                let vm = vmList.find(vm => vm.name === vmName);
                if(vm){
                    if(vm.state === VMState.PAUSED){
                        await vm.resume();
                        return true;
                    } else if(vm.state === VMState.STOPPED || vm.state === VMState.CRASHED){
                        await vm.start();
                        return true;
                    }
                }
            }
        }catch(error){
            //nothing
        }
        return false;
    }

    async pauseVM(vmName: string): Promise<boolean>{
        try{
            let vmList = await this._unraid.vm.list();
            if(vmList && vmList.length > 0){
                let vm = vmList.find(vm => vm.name === vmName);
                if(vm){
                    if(vm.state === VMState.RUNNING || vm.state === VMState.IDL){
                        await vm.suspend();
                        return true;
                    }
                }
            }
        }catch(error){
            //nothing
        }
        return false;
    }

    async stopVM(vmName: string, shutdownMode : IVMShutdownModes): Promise<boolean>{
        try{
            let vmList = await this._unraid.vm.list();
            if(vmList && vmList.length > 0){
                let vm = vmList.find(vm => vm.name === vmName);
                if(vm){
                    if(vm.state === VMState.RUNNING || vm.state === VMState.IDL){
                        await vm.shutdown(shutdownMode);
                        return true;
                    }
                }
            }
        }catch(error){
            //nothing
        }
        return false;
    }

    async rebootVM(vmName: string, rebootMode : IVMRebootModes): Promise<boolean>{
        try{
            let vmList = await this._unraid.vm.list();
            if(vmList && vmList.length > 0){
                let vm = vmList.find(vm => vm.name === vmName);
                if(vm){
                    if(vm.state !== VMState.IN_SHUTDOWN){
                        await vm.reboot(rebootMode);
                        return true;
                    }
                }
            }
        }catch(error){
            //nothing
        }
        return false;
    }

    async getAllUserScripts():Promise<UserScript[]> {
        let userScripts : UserScript[] = [];
        const isAvailable : boolean = await this.isUserScriptsAvailable();
        if(isAvailable){
            try{
                let scripts: US[] = await this._unraid.unraid.getUserScripts();
                if(scripts && scripts.length > 0){
                    scripts.map(script => {
                        let userScript : UserScript = {
                            name: script.name,
                            foregroundOnly: script.foregroundOnly,
                            backgroundOnly: script.backgroundOnly
                        }
                        userScripts.push(userScript);
                    });
                }
            } catch(error){
                //nothing
            }
        }
        return userScripts;
    }

    

    async runUserScriptBgMode(scriptName: string): Promise<boolean>{
        if(await this.isUserScriptsAvailable()){
            try{
                let scripts: US[] = await this._unraid.unraid.getUserScripts();
                if(scripts && scripts.length > 0){
                    let script = scripts.find(script => script.name === scriptName);
                    if(script && !script.foregroundOnly){
                        let isRunning = await script.running();
                        if(!isRunning){
                            await script.startBackground();
                            return true;
                        }
                    }
                }
            } catch(error){
                //nothing
            }
        }
        return false;
    }

    async runUserScriptFgMode(scriptName: string, inputParameterCallback?: (description: string, defaultValue?: string) => Promise<string>): Promise<number>{
        if(await this.isUserScriptsAvailable()){
            try{
                let scripts: US[] = await this._unraid.unraid.getUserScripts();
                if(scripts && scripts.length > 0){
                    let script = scripts.find(script => script.name === scriptName);
                    if(script && !script.backgroundOnly){
                        let isRunning = await script.running();
                        if(!isRunning){
                            let result = await script.start(inputParameterCallback);
                            if(result && result.length > 0){
                                let streamResult = await result[2];
                                return streamResult.code;
                            }
                        }
                    }
                }
            } catch(error){
                //nothing
            }
        }
        return -999;
    }

    async stopUserScript(scriptName: string): Promise<boolean>{
        if(await this.isUserScriptsAvailable()){
            try{
                let scripts: US[] = await this._unraid.unraid.getUserScripts();
                if(scripts && scripts.length > 0){
                    let script = scripts.find(script => script.name === scriptName);
                    if(script){
                        let isRunning = await script.running();
                        if(isRunning){
                            await script.abort();
                            return true;
                        }
                    }
                }
            } catch(error){
                //nothing
            }
        }
        return false;
    }

    async isUserScriptRunning(scriptName: string): Promise<boolean>{
        if(await this.isUserScriptsAvailable()){
            try{
                let scripts: US[] = await this._unraid.unraid.getUserScripts();
                if(scripts && scripts.length > 0){
                    let script = scripts.find(script => script.name === scriptName);
                    if(script){
                        return await script.running();
                    }
                }
            } catch(error){
                //nothing
            }
        }
        return false;
    }


    disconnect() {
        try{
            this._executor.disconnect();
        } catch(error){
            //nothing
        }
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

    async _getRamInfo() : Promise<IMemoryUsage | undefined>{
        let ramInfo : IMemoryUsage = {
            total: 0,
            used: 0,
            free: 0,
            percentUsed: 0,
            raw: ''
        };
        try{
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
        } catch(error){
            return undefined;
        }
    }

    async _getArrayInfo() : Promise<IMemoryUsage | undefined>{
        let arrayInfo : IMemoryUsage = {
            total: 0,
            used: 0,
            free: 0,
            percentUsed: 0,
            raw: ''
        }
        try{
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
        } catch(error){
            return undefined;
        }
    }

    async _getCacheInfo() : Promise<IMemoryUsage | undefined>{
        let cacheInfo : IMemoryUsage = {
            raw: '',
            total: 0,
            used: 0,
            free: 0,
            percentUsed: 0
        };
        try{
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
        } catch(error){
            return undefined;
        }
    }

    async _getUptime() : Promise<IUptimeExt | undefined> {
        try{
            const { code, stdout } = await this._executor.executeSSH({
                command: `awk '{print int($1/3600)"."int(($1%3600)/60)}' /proc/uptime`
            });
            const uptime : IUptimeExt = {
                upSince:  (code === 0) && this._isNumber(stdout[0].trim()) ? Number(stdout[0].trim()) : undefined,
                uptime: await this._unraid.system.uptime()
            }
            return uptime;
        } catch(error){
            return undefined;
        }
    }

    async _getCpuUsage() : Promise<ICPUUsage | undefined>{
        try{
            const usage : CPUUsage = await this._unraid.system.usage();
            const cpuUsage : ICPUUsage = {
                percentIdle: Math.round(usage.all.idle * 100) / 100,
                percentBusy: Math.round((100-usage.all.idle) * 100) / 100,
                usage: usage
            };
            return cpuUsage;
        } catch(error){
            return undefined;
        }
    }
}

export { UnraidRemote }