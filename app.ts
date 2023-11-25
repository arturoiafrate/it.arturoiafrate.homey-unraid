import Homey from 'homey';

class UnraidRemoteApp extends Homey.App {

  async onInit() {
    await this._initConditionCards();
  }

  async _initConditionCards(): Promise<void> {
    //CPU Usage
    const cpuUsageCondition = this.homey.flow.getConditionCard('cpu-usage-condition');
    cpuUsageCondition.registerRunListener(async (args) => {
      if(!args.threshold){
        throw new Error('Threshold is not set');
      }
      const devices : Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      for(const device of devices){
        if(device.hasCapability('cpuused')){
          const cpuUsage = await device.getCapabilityValue('cpuused');
          if(cpuUsage > args.threshold){
            return Promise.resolve(true);
          }
        }
      }
      return Promise.resolve(false);
    });
    //Array Usage
    const arrayUsageCondition = this.homey.flow.getConditionCard('array-usage-condition');
    arrayUsageCondition.registerRunListener(async (args) => {
      if(!args.threshold){
        throw new Error('Threshold is not set');
      }
      const devices : Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      for(const device of devices){
        if(device.hasCapability('cpuused')){
          const arrayUsage = await device.getCapabilityValue('arrayused');
          if(arrayUsage > args.threshold){
            return Promise.resolve(true);
          }
        }
      }
      return Promise.resolve(false);
    });
  }
}

module.exports = UnraidRemoteApp;
