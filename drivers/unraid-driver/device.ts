import Homey, { FlowCardTriggerDevice } from 'homey';
import { UnraidRemote } from './unraid-remote/UnraidRemote';
import { ISystemStats } from './unraid-remote/utils/ISystemStats';
import { isNonEmpty } from '../../utils/utilites';
import { UnraidRemoteFlowTrigger } from './unraid-remote/triggers/UnraidRemoteFlowTrigger';

class UnraidRemoteDevice extends Homey.Device {

  _unraidRemote?: UnraidRemote;
  _pingPoller?: NodeJS.Timeout;
  _checkPoller?: NodeJS.Timeout;
  _isInit: boolean = false;
  _flowTriggers?: UnraidRemoteFlowTrigger;


  async onInit() {
    this._addCapabilities();
    this._flowTriggers = new UnraidRemoteFlowTrigger({
      cpuUsageTriggerCard: this.homey.flow.getDeviceTriggerCard('cpu-usage-is-changed'), 
      arrayUsageTriggerCard: this.homey.flow.getDeviceTriggerCard('array-usage-is-changed')
    });
    const settings = await this.getSettings();
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
    let settings = await this.getSettings();
    changedKeys.forEach((settingKey) => {//Reading new settings
      if(settingKey === 'host') {
        settings.host = newSettings[settingKey];
      }
      if(settingKey === 'username') {
        settings.username = newSettings[settingKey];
      }
      if(settingKey === 'password') {
        settings.password = newSettings[settingKey];
      }
      if(settingKey === 'port') {
        settings.port = newSettings[settingKey];
      }
      if(settingKey === 'pingInterval'){
        settings.pingInterval = newSettings[settingKey];
      }
      if(settingKey === 'macaddress'){
        settings.macaddress = newSettings[settingKey];
      }
      if(settingKey === 'checkInterval'){
        settings.checkInterval = newSettings[settingKey];
      }
    });
    this._initUnraidRemote(settings.host, settings.username, settings.password, settings.port, settings.pingInterval, settings.checkInterval);
    return this.homey.__("settings_saved_ok");
  }

  async onDeleted() {
    this._pingPollerStop();
    this._checkPollerStop();
    if(this._unraidRemote){
      this._unraidRemote.unsubscribeAll();
      this._unraidRemote.disconnect();
      await this.setUnavailable();
    }
  }

  async _initUnraidRemote(url: string, username: string, password: string, port: number, pingInterval: number, checkInterval: number) {
    if(this._unraidRemote){
      this._unraidRemote.unsubscribeAll();
      this._unraidRemote.disconnect();
    }
    if(isNonEmpty(url) && isNonEmpty(username) && isNonEmpty(password)){
      this._unraidRemote = new UnraidRemote(url, username, password, port);
      this._unraidRemote.subscribeIsUnraidServerOnline({
        isOnlineCallback: () => {
          this.homey.setTimeout(() => {
            this.setCapabilityValue("onoff", true); 
            this.setAvailable();
            if(!this._isInit && this._unraidRemote){
              this._unraidRemote.systemInfo().then((systemInfo) => {
                this._updateDeviceCapabilities(systemInfo, true);
                this._isInit = true;
              });
            }
          }, 500);
        },
        isOfflineCallback: () => {
          this.homey.setTimeout(() => {
            this.setCapabilityValue("onoff", false);
            this.setUnavailable();
          }, 500);
        }
      });
      this._unraidRemote.ping();
      this._pingPollerStart(pingInterval == 0 ? 3 : pingInterval);
      this._checkPollerStart(checkInterval == 0 ? 6 : checkInterval);
    } else {
      this.homey.setTimeout(() => {
        this.setCapabilityValue("onoff", false);
        this.setUnavailable();
      }, 500);
    }
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
          this._unraidRemote.systemStats().then(sysStats => {
            this._updateDeviceCapabilities(sysStats, false);
          }).catch(this.error);
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


  _updateDeviceCapabilities(systemStats : ISystemStats, setInfo : boolean) : void{
    if(setInfo){
      this.setCapabilityValue("raminfo", systemStats.ramUsage.total).catch(this.error);
      this.setCapabilityValue("arrayinfo", systemStats.arrayUsage.total).catch(this.error);
    }
    this.setCapabilityValue("uptime", systemStats.uptime.upSince).catch(this.error);
    //CPU Used
    const oldCPUUsedValue : number = this.hasCapability('cpuused') ? this.getCapabilityValue("cpuused") : 0;
    this.setCapabilityValue("cpuused", systemStats.cpuUsage.percentBusy).catch(this.error);
    if(oldCPUUsedValue != systemStats.cpuUsage.percentBusy) this._flowTriggers?.triggerCpuUsageFlowCard(this, systemStats.cpuUsage.percentBusy);
    //Array Used
    const oldArrayUsedValue : number = this.hasCapability('arrayused') ? this.getCapabilityValue("arrayused") : 0;
    this.setCapabilityValue("arrayused", systemStats.arrayUsage.percentUsed).catch(this.error);
    if(oldArrayUsedValue != systemStats.arrayUsage.percentUsed) this._flowTriggers?.triggerArrayUsageFlowCard(this, systemStats.arrayUsage.percentUsed);
    this.setCapabilityValue("cacheused", systemStats.cacheUsage.percentUsed).catch(this.error);
    this.setCapabilityValue("ramused", systemStats.ramUsage.percentUsed).catch(this.error);
  }

  async _turnOn(){
    const settings = await this.getSettings();
    if(isNonEmpty(settings.macaddress) && this._unraidRemote){
      this._unraidRemote.turnOn(settings.macaddress);
    }
    this._initUnraidRemote(settings.host, settings.username, settings.password, settings.port, settings.pingInterval, settings.checkInterval);
  }

  async _turnOff(){
    if(this._unraidRemote){
      this._unraidRemote.turnOff();
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
    if (this.hasCapability('cpuused') === false) {
      await this.addCapability('cpuused');
    }
  }

}

module.exports = UnraidRemoteDevice;
