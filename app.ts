import Homey from 'homey';
import { convertToUnraidUptime, objStringify } from './utils/utilites';
import { UnraidRemoteDevice } from './drivers/unraid-driver/device';

class UnraidRemoteApp extends Homey.App {

  async onInit() {
    await this._initConditionCards();
    await this._initActionCards();
  }

  async _initConditionCards(): Promise<void> {
    //System Uptime
    const systemUptimeCondition = this.homey.flow.getConditionCard('uptime-condition');
    systemUptimeCondition.registerRunListener(async (args) => {
      if(!args.years && !args.days && !args.hours && !args.minutes){
        throw new Error('Threshold is not set');
      }
      const argsUptime = convertToUnraidUptime(args.years, args.days, args.hours, args.minutes);
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      for (const device of devices) {
        if (device.hasCapability('uptime')) {
          const uptime: number | undefined = await device.getCapabilityValue('uptime');
          if (!uptime) {
            throw new Error('Uptime is not set');
          }
          if (Number(uptime) > argsUptime) {
            return Promise.resolve(true);
          }
        }
      }
      return Promise.resolve(false);
    });
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

  async _initActionCards(): Promise<void> {
    //SSH Command (simple)
    const sshExecutorAction = this.homey.flow.getActionCard('execute-ssh-command');
    sshExecutorAction.registerRunListener(async (args) => {
      if(!args.command){
        throw new Error('Command is not set');
      }
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      unraidDevice.executeShellCommandNoWait(args.command);
    });
    //SSH Command (advanced)
    const sshAdvancedExecutorAction = this.homey.flow.getActionCard('execute-ssh-command-adv');
    sshAdvancedExecutorAction.registerRunListener(async (args) => {
      if(!args.command){
        throw new Error('Command is not set');
      }
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      try {
        return await unraidDevice.executeShellCommand(args.command);
      } catch (error) {
        return {
          code: -997,
          stdout: '',
          stderr: 'Unknown exception'
        }
      }
    });
  }
}

module.exports = UnraidRemoteApp;
