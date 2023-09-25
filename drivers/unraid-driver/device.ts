import Homey from 'homey';
import { UnraidRemote } from './unraid-remote/UnraidRemote';

class UnraidRemoteDevice extends Homey.Device {

  _unraidRemote?: UnraidRemote;

  _pingPoller?: NodeJS.Timeout;


  async onInit() {
    this.registerCapabilityListener("onoff", async (value, opts) => {//button
      if(value){
        await this.#turnOn();
      } else {
        await this.#turnOff();
      }
    });
    const settings = await this.getSettings();
    this.#initUnraidRemote(settings.host, settings.username, settings.password, settings.port, settings.pingInterval);
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
    const settings = await this.getSettings();
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
    });
    this.#initUnraidRemote(settings.host, settings.username, settings.password, settings.port, settings.pingInterval);
    return this.homey.__("settings_saved_ok");
  }

  async onDeleted() {
    this.#pingPollerStop();
    if(this._unraidRemote){
      this._unraidRemote.unsubscribeAll();
      this._unraidRemote.disconnect();
      await this.setUnavailable();
    }
  }

  async #initUnraidRemote(url: string, username: string, password: string, port: number, pingInterval: number) {
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
      this.#pingPollerStart(pingInterval == 0 ? 30 : pingInterval);
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

  #isNonEmpty(str: string): boolean {
    return typeof str === 'string' && str.length > 0;
  }

  async #turnOn(){
    const settings = await this.getSettings();
    if(this.#isNonEmpty(settings.macaddress) && this._unraidRemote){
      this._unraidRemote.turnOn(settings.macaddress);
    }
    this.#initUnraidRemote(settings.host, settings.username, settings.password, settings.port, settings.pingInterval);
  }

  async #turnOff(){
    if(this._unraidRemote){
      this._unraidRemote.turnOff();
    }
  }
}

module.exports = UnraidRemoteDevice;
