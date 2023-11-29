import Homey from 'homey';
import { convertToUnraidUptime, logErrorToSentry } from './utils/utilites';
import { UnraidRemoteDevice } from './drivers/unraid-driver/device';
import { Container } from './drivers/unraid-driver/unraid-remote/utils/IDockerContainer';
const { Log } = require('homey-log');

class UnraidRemoteApp extends Homey.App {
   homeyLog: any;

  async onInit() {
    this.homeyLog = new Log({ homey: this.homey });
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
        if(device.hasCapability('arrayused')){
          const arrayUsage = await device.getCapabilityValue('arrayused');
          if(arrayUsage > args.threshold){
            return Promise.resolve(true);
          }
        }
      }
      return Promise.resolve(false);
    });
    //RAM Usage
    const ramUsageCondition = this.homey.flow.getConditionCard('ram-usage-condition');
    ramUsageCondition.registerRunListener(async (args) => {
      if(!args.threshold){
        throw new Error('Threshold is not set');
      }
      const devices : Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      for(const device of devices){
        if(device.hasCapability('ramused')){
          const ramUsage = await device.getCapabilityValue('ramused');
          if(ramUsage > args.threshold){
            return Promise.resolve(true);
          }
        }
      }
      return Promise.resolve(false);
    });
    //Container is running
    const containerRunningCondition = this.homey.flow.getConditionCard('container-is-running-condition');
    containerRunningCondition.registerArgumentAutocompleteListener('container', async (query, args) => {
      const devices : Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const containers = await unraidDevice.containerList();
      return containers.filter((container) => {
        return container.name.toLowerCase().includes(query.toLowerCase());
      });
    });
    containerRunningCondition.registerRunListener(async (args) => {
      if(!args.container){
        throw new Error('Container is not set');
      }
      const container = args.container as Container;
      const devices : Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      return Promise.resolve(await unraidDevice.isContainerRunning(container.id));
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
        logErrorToSentry(this, error as Error);
        return {
          code: -997,
          stdout: '',
          stderr: 'Unknown exception'
        }
      }
    });
    //Start Container
    const startContainerAction = this.homey.flow.getActionCard('container-start');
    startContainerAction.registerArgumentAutocompleteListener('container', async (query, args) => {
      const devices : Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const containers = await unraidDevice.containerList();
      return containers.filter((container) => {
        return container.name.toLowerCase().includes(query.toLowerCase());
      });
    });
    startContainerAction.registerRunListener(async (args) => {
      if(!args.container){
        throw new Error('Container is not set');
      }
      const container = args.container as Container;
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      unraidDevice.startContainer(container.id);
    });
    //Stop Container
    const stopContainerAction = this.homey.flow.getActionCard('container-stop');
    stopContainerAction.registerArgumentAutocompleteListener('container', async (query, args) => {
      const devices : Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const containers = await unraidDevice.containerList();
      return containers.filter((container) => {
        return container.name.toLowerCase().includes(query.toLowerCase());
      });
    });
    stopContainerAction.registerRunListener(async (args) => {
      if(!args.container){
        throw new Error('Container is not set');
      }
      const container = args.container as Container;
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      unraidDevice.stopContainer(container.id);
    });
    //Toggle Container
    const toggleContainerAction = this.homey.flow.getActionCard('container-toggle');
    toggleContainerAction.registerArgumentAutocompleteListener('container', async (query, args) => {
      const devices : Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const containers = await unraidDevice.containerList();
      return containers.filter((container) => {
        return container.name.toLowerCase().includes(query.toLowerCase());
      });
    });
    toggleContainerAction.registerRunListener(async (args) => {
      if(!args.container){
        throw new Error('Container is not set');
      }
      const container = args.container as Container;
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const isOnline : boolean = await unraidDevice.isContainerRunning(container.id);
      isOnline ? unraidDevice.stopContainer(container.id) : unraidDevice.startContainer(container.id);
    });
  }
}

module.exports = UnraidRemoteApp;
export { UnraidRemoteApp };