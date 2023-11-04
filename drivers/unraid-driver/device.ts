import Homey from 'homey';
import { UnraidRemote } from './unraid-remote/UnraidRemote';

class UnraidRemoteDevice extends Homey.Device {

  _unraidRemote?: UnraidRemote;
  _pingPoller?: NodeJS.Timeout;
  _checkPoller?: NodeJS.Timeout;
  _systemInfo?: any;


  async onInit() {
    this.registerCapabilityListener("onoff", async (value, opts) => {//button
      if(value){
        await this.#turnOn();
      } else {
        await this.#turnOff();
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
    const settings = await this.getSettings();
    this.#initUnraidRemote(settings.host, settings.username, settings.password, settings.port, settings.pingInterval, settings.checkInterval);
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
    this.#initUnraidRemote(settings.host, settings.username, settings.password, settings.port, settings.pingInterval, settings.checkInterval);
    return this.homey.__("settings_saved_ok");
  }

  async onDeleted() {
    this.#pingPollerStop();
    this.#checkPollerStop();
    if(this._unraidRemote){
      this._unraidRemote.unsubscribeAll();
      this._unraidRemote.disconnect();
      await this.setUnavailable();
    }
  }

  async #initUnraidRemote(url: string, username: string, password: string, port: number, pingInterval: number, checkInterval: number) {
    if(this._unraidRemote){
      this._unraidRemote.unsubscribeAll();
      this._unraidRemote.disconnect();
    }
    if(this.#isNonEmpty(url) && this.#isNonEmpty(username) && this.#isNonEmpty(password)){
      this._unraidRemote = new UnraidRemote(url, username, password, port);
      this._unraidRemote.subscribeIsUnraidServerOnline({
        isOnlineCallback: () => {
          this.homey.setTimeout(() => {
            this.setCapabilityValue("onoff", true); 
            this.setAvailable();
            if(!this._systemInfo && this._unraidRemote){
              this._unraidRemote.systemInfo().then((systemInfo) => {
                this._systemInfo = systemInfo;
                //this.log('systemInfo: ' + JSON.stringify(systemInfo));
                this.setCapabilityValue("raminfo", systemInfo.ram.total).catch(this.error);
                this.setCapabilityValue("ramused", systemInfo.ram.percentUsed).catch(this.error);
                this.setCapabilityValue("arrayinfo", systemInfo.array.total).catch(this.error);
                this.setCapabilityValue("arrayused", systemInfo.array.percentUsed).catch(this.error);
                this.setCapabilityValue("cacheused", systemInfo.cache.percentUsed).catch(this.error);
                this.setCapabilityValue("uptime", systemInfo.uptime.upSince).catch(this.error);
                this.setCapabilityValue("cpuused", systemInfo.cpu.percentBusy).catch(this.error);
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
      this.#pingPollerStart(pingInterval == 0 ? 3 : pingInterval);
      this.#checkPollerStart(checkInterval == 0 ? 6 : checkInterval);
    } else {
      this.homey.setTimeout(() => {
        this.setCapabilityValue("onoff", false);
        this.setUnavailable();
      }, 500);
    }
  }

  #pingPollerStart(pingInterval: number) {
    if(this._unraidRemote){
      this.#pingPollerStop();
      this._pingPoller = this.homey.setInterval(this._unraidRemote.ping.bind(this._unraidRemote), pingInterval * 1000);
    }
  }

  #pingPollerStop() {
    if(this._pingPoller){
      this.homey.clearInterval(this._pingPoller);
      this._pingPoller = undefined;
    }
  }

  #checkPollerStart(checkInterval: number) {
    if(this._unraidRemote){
      this.#checkPollerStop();
      this._checkPoller = this.homey.setInterval( () => {
        if(this._unraidRemote && this._unraidRemote.isOnline){
          this._unraidRemote.systemStats().then(sysStats => {
            //TODO
            //this.log('sysStats: ' + JSON.stringify(sysStats));
            this.setCapabilityValue("uptime", sysStats.uptime.upSince).catch(this.error);
            this.setCapabilityValue("cpuused", sysStats.cpuUsage.percentBusy).catch(this.error);
            this.setCapabilityValue("arrayused", sysStats.arrayUsage.percentUsed).catch(this.error);
            this.setCapabilityValue("cacheused", sysStats.cacheUsage.percentUsed).catch(this.error);
            this.setCapabilityValue("ramused", sysStats.ramUsage.percentUsed).catch(this.error);
          }).catch(this.error);
        }
      }, checkInterval * 1000);
    }
  }

  #checkPollerStop(){
    if(this._checkPoller){
      this.homey.clearInterval(this._checkPoller);
      this._checkPoller = undefined;
    }
  }

  #isNonEmpty(str: string): boolean {
    return typeof str === 'string' && str.length > 0;
  }

  async #turnOn(){
    const settings = await this.getSettings();
    if(this.#isNonEmpty(settings.macaddress) && this._unraidRemote){
      this._unraidRemote.turnOn(settings.macaddress);
    }
    this.#initUnraidRemote(settings.host, settings.username, settings.password, settings.port, settings.pingInterval, settings.checkInterval);
  }

  async #turnOff(){
    if(this._unraidRemote){
      this._unraidRemote.turnOff();
    }
  }
}

module.exports = UnraidRemoteDevice;
