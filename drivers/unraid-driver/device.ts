import Homey from 'homey';
import { UnraidRemote } from './unraid-remote/UnraidRemote';
import { ISystemStats, ISSHCommandOutput } from './unraid-remote/utils/ISystemStats';
import { LogLevel, isNonEmpty, logMessageToSentry, logErrorToSentry, objStringify } from '../../utils/utilites';
import { UnraidRemoteFlowTrigger } from './unraid-remote/triggers/UnraidRemoteFlowTrigger';
import { UnraidRemoteApp } from '../../app';
import { Container } from './unraid-remote/utils/IDockerContainer';
import { UserScript } from './unraid-remote/utils/IUserScript';
import { VirtualMachine } from './unraid-remote/utils/IVirtualMachine';
import { IVMRebootModes, IVMShutdownModes, VMState } from '@ridenui/unraid/dist/modules/vms/vm';

class UnraidRemoteDevice extends Homey.Device {

  private _unraidRemote?: UnraidRemote;
  private _pingPoller?: NodeJS.Timeout;
  private _checkPoller?: NodeJS.Timeout;
  private _isInit: boolean = false;
  private _flowTriggers?: UnraidRemoteFlowTrigger;
  private _enableDockerMonitoring: boolean = false;


  async onInit() {
    this._addCapabilities();
    this.homey.flow.getDeviceTriggerCard('docker-container-status-changed').registerArgumentAutocompleteListener('container', async (query, args) => {
      const containers = await this.containerList();
      return containers.filter((container) => {
        return container.name.toLowerCase().includes(query.toLowerCase());
      });
    });
    this._flowTriggers = new UnraidRemoteFlowTrigger({
      cpuUsageTriggerCard: this.homey.flow.getDeviceTriggerCard('cpu-usage-is-changed'), 
      arrayUsageTriggerCard: this.homey.flow.getDeviceTriggerCard('array-usage-is-changed'),
      cacheUsageTriggerCard: this.homey.flow.getDeviceTriggerCard('cache-usage-is-changed'),
      ramUsageTriggerCard: this.homey.flow.getDeviceTriggerCard('ram-usage-is-changed'),
      dockerContainerStatusChangedTriggerCard: this.homey.flow.getDeviceTriggerCard('docker-container-status-changed')
    });
    let settings = await this.getSettings();
    this._enableDockerMonitoring = settings.enableDockerMonitoring as boolean;
    this._initUnraidRemote(settings.host, settings.username, settings.password, settings.port, settings.pingInterval, settings.checkInterval);
  }

  async onAdded() {}

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings, newSettings, changedKeys, }: {
    oldSettings: { [key: string]: boolean | string | number | undefined | null };
    newSettings: { [key: string]: boolean | string | number | undefined | null };
    changedKeys: string[];
  }): Promise<string | void> {
    let checkConnection = await UnraidRemote.testConnection(newSettings.host as string, newSettings.port as number);
    let checkSSHConnection : boolean = false;
    if(checkConnection){
      checkSSHConnection = await UnraidRemote.testSSHConnection(newSettings.host as string, newSettings.port as number, newSettings.username as string, newSettings.password as string);
    }
    this._enableDockerMonitoring = newSettings.enableDockerMonitoring as boolean;
    this._initUnraidRemote(newSettings.host as string, newSettings.username as string, newSettings.password as string, newSettings.port as number, newSettings.pingInterval as number, newSettings.checkInterval as number);
    if(checkConnection && checkSSHConnection){
      return this.homey.__("settings_saved_ok");
    } else {
      if(!checkConnection){
        return this.homey.__("settings_saved_ok_but_unraid_offline");
      } else {
        return this.homey.__("settings_saved_ok_but_can_not_connect_to_unraid");
      }
    }
  }

  async onDeleted() {
    this._pingPollerStop();
    this._checkPollerStop();
    if(this._unraidRemote){
      try{
        this._unraidRemote.unsubscribeAll();
        this._unraidRemote.disconnect();
      } catch(error){
        //logErrorToSentry(this.homey.app as UnraidRemoteApp, error as Error);
      }
      await this.setUnavailable();
    }
  }

  executeShellCommandNoWait(command: string): void{
    if(this._unraidRemote && command){
      try{
        this._unraidRemote.executeShellCommand(command);
      } catch(error){
        //logErrorToSentry(this.homey.app as UnraidRemoteApp, error as Error);
      }
    }
  }
  
  async executeShellCommand(command: string): Promise<ISSHCommandOutput>{
    if(this._unraidRemote && command){
      try{
        return this._unraidRemote.executeShellCommand(command);
      } catch(error){
        //logErrorToSentry(this.homey.app as UnraidRemoteApp, error as Error);
        const err = error as Error;
        let out : ISSHCommandOutput = {
          code: -990,
          stdout: undefined,
          stderr: err.message
        };
        return out;
      }
      
    } else {
      let out : ISSHCommandOutput = {
        code: -998,
        stdout: undefined,
        stderr: 'UnraidRemote is not initialized'
      };
      return out;
    }
  }

  async _initUnraidRemote(url: string, username: string, password: string, port: number, pingInterval: number, checkInterval: number) {
    if(this._unraidRemote){
      this._unraidRemote.unsubscribeAll();
      this._unraidRemote.disconnect();
    }
    if(isNonEmpty(url) && isNonEmpty(username) && isNonEmpty(password)){
      logMessageToSentry(this.homey.app as UnraidRemoteApp, 'UnraidRemote is initializing..', LogLevel.INFO);
      this._unraidRemote = new UnraidRemote(url, username, password, port);
      this._unraidRemote.subscribeIsUnraidServerOnline({
        isOnlineCallback: () => {
          this.homey.setTimeout(() => {
            logMessageToSentry(this.homey.app as UnraidRemoteApp, 'Unraid Server is online.', LogLevel.INFO);
            this.setCapabilityValue("onoff", true); 
            this.setAvailable();
            if(!this._isInit && this._unraidRemote){
              try{
                this._unraidRemote.systemInfo().then((systemInfo) => {
                  this._updateDeviceCapabilities(systemInfo, true);
                  this._isInit = true;
                });
              } catch(error){
                //logErrorToSentry(this.homey.app as UnraidRemoteApp, error as Error);
              }
            }
          }, 500);
        },
        isOfflineCallback: () => {
          this.homey.setTimeout(() => {
            logMessageToSentry(this.homey.app as UnraidRemoteApp, 'Unraid Server is offline.', LogLevel.INFO);
            this._setOffline();
          }, 500);
        }
      });
      this._unraidRemote.ping();
      this._pingPollerStart(pingInterval == 0 ? 3 : pingInterval);
      this._checkPollerStart(checkInterval == 0 ? 6 : checkInterval);
    } else {
      logMessageToSentry(this.homey.app as UnraidRemoteApp, 'UnraidRemote is not initialized', LogLevel.INFO);
      this.homey.setTimeout(() => {
        this._setOffline();
      }, 500);
    }
  }

  async containerList(): Promise<Container[]>{
    if(!this._unraidRemote) throw new Error('UnraidRemote is not initialized');
    return await this._unraidRemote.containerList();
  }

  async isContainerRunning(containerId: string): Promise<boolean>{
    if(!this._unraidRemote) throw new Error('UnraidRemote is not initialized');
    return await this._unraidRemote.isContainerRunning(containerId);
  }

  async startContainer(containerId: string): Promise<boolean>{
    if(!this._unraidRemote) throw new Error('UnraidRemote is not initialized');
    return await this._unraidRemote.startContainer(containerId);
  }

  async stopContainer(containerId: string): Promise<boolean>{
    if(!this._unraidRemote) throw new Error('UnraidRemote is not initialized');
    return await this._unraidRemote.stopContainer(containerId);
  }

  async userScriptList(): Promise<UserScript[]>{
    if(!this._unraidRemote) throw new Error('UnraidRemote is not initialized');
    return await this._unraidRemote.getAllUserScripts();
  }

  async isUserScriptRunning(userScriptName: string): Promise<boolean>{
    if(!this._unraidRemote) throw new Error('UnraidRemote is not initialized');
    return await this._unraidRemote.isUserScriptRunning(userScriptName);
  }

  async startBackgroundUserScript(userScriptName: string): Promise<void>{
    if(!this._unraidRemote) throw new Error('UnraidRemote is not initialized');
    await this._unraidRemote.runUserScriptBgMode(userScriptName);
  }

  async startForegroundUserScript(userScriptName: string): Promise<number>{
    if(!this._unraidRemote) throw new Error('UnraidRemote is not initialized');
    return await this._unraidRemote.runUserScriptFgMode(userScriptName);
  }

  async stopUserScriptExecution(userScriptName: string): Promise<void>{
    if(!this._unraidRemote) throw new Error('UnraidRemote is not initialized');
    await this._unraidRemote.stopUserScript(userScriptName);
  }

  async vmList(): Promise<VirtualMachine[]>{
    if(!this._unraidRemote) throw new Error('UnraidRemote is not initialized');
    return await this._unraidRemote.getAllVMs();
  }

  async getVMStatus(vmName: string): Promise<VMState | undefined>{
    if(!this._unraidRemote) throw new Error('UnraidRemote is not initialized');
    return await this._unraidRemote.getVMStatus(vmName);
  }

  async startOrResumeVM(vmName: string): Promise<boolean>{
    if(!this._unraidRemote) throw new Error('UnraidRemote is not initialized');
    return await this._unraidRemote.startOrResumeVM(vmName);
  }

  async stopVM(vmName: string, shutdownMode: IVMShutdownModes): Promise<boolean>{
    if(!this._unraidRemote) throw new Error('UnraidRemote is not initialized');
    return await this._unraidRemote.stopVM(vmName, shutdownMode);
  }

  async pauseVM(vmName: string): Promise<boolean>{
    if(!this._unraidRemote) throw new Error('UnraidRemote is not initialized');
    return await this._unraidRemote.pauseVM(vmName);
  }

  async rebootVM(vmName: string, rebootMode: IVMRebootModes): Promise<boolean>{//TODO
    if(!this._unraidRemote) throw new Error('UnraidRemote is not initialized');
    return await this._unraidRemote.rebootVM(vmName, rebootMode);
  }

  _setOffline(): void{
    this.setCapabilityValue("onoff", false);
    this.setUnavailable();
    this._resetDeviceCapabilities();
    this._isInit = false;
  }

  _pingPollerStart(pingInterval: number) {
    if(this._unraidRemote){
      this._pingPollerStop();
      this._pingPoller = this.homey.setInterval(this._unraidRemote.ping.bind(this._unraidRemote), pingInterval * 1000);
    }
  }

  _pingPollerStop() {
    if(this._pingPoller){
      this.homey.clearInterval(this._pingPoller);
      this._pingPoller = undefined;
    }
  }

  _checkPollerStart(checkInterval: number) {
    if(this._unraidRemote){
      this._checkPollerStop();
      this._checkPoller = this.homey.setInterval( () => {
        if(this._unraidRemote && this._unraidRemote.isOnline){
          try{
            this._unraidRemote.systemStats().then(sysStats => {
              this._updateDeviceCapabilities(sysStats, false);
            });//.catch(this.error);
          }catch(error){
            //logErrorToSentry(this.homey.app as UnraidRemoteApp, error as Error);
          }
        }
      }, checkInterval * 1000);
    }
  }

  _checkPollerStop(){
    if(this._checkPoller){
      this.homey.clearInterval(this._checkPoller);
      this._checkPoller = undefined;
    }
  }

  _resetDeviceCapabilities() : void{
    this.setCapabilityValue("raminfo", 0);//.catch(this.error);
    this.setCapabilityValue("arrayinfo", 0);//.catch(this.error);
    this._updateUptimeCapability(0);
    this._updateCpuUsedCapability(0);
    this._updateArrayUsedCapability(0);
    this._updateCacheUsedCapability(0);
    this._updateRamUsedCapability(0);
  }

  async _updateDeviceCapabilities(systemStats : ISystemStats, setInfo : boolean) : Promise<void>{
    logMessageToSentry(this.homey.app as UnraidRemoteApp, objStringify('Updating device capabilities with stats: ', systemStats), LogLevel.INFO);
    if(setInfo){
      if(systemStats.ramUsage) this.setCapabilityValue("raminfo", systemStats.ramUsage.total)//.catch(this.error);
      if(systemStats.arrayUsage) this.setCapabilityValue("arrayinfo", systemStats.arrayUsage.total)//.catch(this.error);
    }
    if(systemStats.uptime) this._updateUptimeCapability(systemStats.uptime.upSince);
    if(systemStats.cpuUsage) this._updateCpuUsedCapability(systemStats.cpuUsage.percentBusy);
    if(systemStats.arrayUsage) this._updateArrayUsedCapability(systemStats.arrayUsage.percentUsed);
    if(systemStats.cacheUsage) this._updateCacheUsedCapability(systemStats.cacheUsage.percentUsed);
    if(systemStats.ramUsage) this._updateRamUsedCapability(systemStats.ramUsage.percentUsed);
    if(this._enableDockerMonitoring){
      this._flowTriggers?.triggerDockerContainerStatusChangedFlowCard(this, await this.containerList());
    }
  }

  _updateUptimeCapability(uptime : number|undefined) : void{
    this.setCapabilityValue("uptime", uptime);//.catch(this.error);
    let days = 0;
    let hours = 0;
    let minutes = '0';
    if(uptime && typeof uptime === 'number'){
      let integerPart = Math.trunc(uptime);
      minutes = Number((uptime-integerPart).toFixed(2)).toString().split('.')[1];
      if(integerPart > 24){
        days = Math.trunc(integerPart / 24);
        hours = Math.trunc(integerPart % 24);
      } else {
        hours = integerPart;
      }
    }
    const uptimeString = days + 'd ' + hours + 'h ' + minutes + 'm';
    this.setCapabilityValue("friendlyUptime", uptimeString)//.catch(this.error);
  }

  _updateCpuUsedCapability(cpuUsed : number) : void{
    const value = Number(cpuUsed.toFixed(2));
    const oldCPUUsedValue : number = this.hasCapability('cpuused') ? this.getCapabilityValue('cpuused') : 0;
    this.setCapabilityValue('cpuused', value);//.catch(this.error);
    if(oldCPUUsedValue != value) this._flowTriggers?.triggerCpuUsageFlowCard(this, value);
  }

  _updateArrayUsedCapability(arrayUsed : number) : void{
    const value = Number(arrayUsed.toFixed(2));
    const oldArrayUsedValue : number = this.hasCapability('arrayused') ? this.getCapabilityValue('arrayused') : 0;
    this.setCapabilityValue('arrayused', value);//.catch(this.error);
    if(oldArrayUsedValue != value) this._flowTriggers?.triggerArrayUsageFlowCard(this, value);
  }

  _updateCacheUsedCapability(cacheUsed : number) : void{
    const value = Number(cacheUsed.toFixed(2)); 
    const oldCacheUsedValue : number = this.hasCapability('cacheused') ? this.getCapabilityValue('cacheused') : 0;
    this.setCapabilityValue("cacheused", value);//.catch(this.error);
    if(oldCacheUsedValue != value) this._flowTriggers?.triggerCacheUsageFlowCard(this, value);
  }

  _updateRamUsedCapability(ramUsed : number) : void{
    const value = Number(ramUsed.toFixed(2));
    const oldRamUsedValue : number = this.hasCapability('ramused') ? this.getCapabilityValue('ramused') : 0;
    this.setCapabilityValue("ramused", value);//.catch(this.error);
    if(oldRamUsedValue != value) this._flowTriggers?.triggerRamUsageFlowCard(this, value);
  }

  async _turnOn(){
    const settings = await this.getSettings();
    if(isNonEmpty(settings.macaddress) && this._unraidRemote){
      try{
        this._unraidRemote.turnOn(settings.macaddress);
      } catch(error){
        //logErrorToSentry(this.homey.app as UnraidRemoteApp, error as Error);
      }
    }
    this._enableDockerMonitoring = settings.enableDockerMonitoring as boolean;
    this._initUnraidRemote(settings.host, settings.username, settings.password, settings.port, settings.pingInterval, settings.checkInterval);
  }

  async _turnOff(){
    if(this._unraidRemote){
      try{
        this._unraidRemote.turnOff();
      } catch(error){
        //logErrorToSentry(this.homey.app as UnraidRemoteApp, error as Error);
      }
    }
  }
  
  async _addCapabilities(): Promise<void> {
    this.registerCapabilityListener("onoff", async (value, opts) => {
      if(value){
        await this._turnOn();
      } else {
        await this._turnOff();
      }
    });
    if (this.hasCapability('raminfo') === false) {
      await this.addCapability('raminfo');
    }
    if (this.hasCapability('ramused') === false) {
      await this.addCapability('ramused');
    }
    if (this.hasCapability('arrayinfo') === false) {
      await this.addCapability('arrayinfo');
    }
    if (this.hasCapability('arrayused') === false) {
      await this.addCapability('arrayused');
    }
    if (this.hasCapability('cacheused') === false) {
      await this.addCapability('cacheused');
    }
    if (this.hasCapability('uptime') === false) {
      await this.addCapability('uptime');
    }
    if (this.hasCapability('friendlyUptime') === false) {
      await this.addCapability('friendlyUptime');
    }
    if (this.hasCapability('cpuused') === false) {
      await this.addCapability('cpuused');
    }
  }

}

module.exports = UnraidRemoteDevice;
export { UnraidRemoteDevice };
