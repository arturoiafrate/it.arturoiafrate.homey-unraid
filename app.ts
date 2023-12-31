import Homey from 'homey';
import { convertToUnraidUptime, logErrorToSentry } from './utils/utilites';
import { UnraidRemoteDevice } from './drivers/unraid-driver/device';
import { Container } from './drivers/unraid-driver/unraid-remote/utils/IDockerContainer';
import { UserScript } from './drivers/unraid-driver/unraid-remote/utils/IUserScript';
import { VM, VMState } from '@ridenui/unraid/dist/modules/vms/vm';
import { State, Mode } from './drivers/unraid-driver/unraid-remote/utils/IVirtualMachine';
import { IVMRebootModes, IVMShutdownModes } from '@ridenui/unraid/dist/modules/vms/vm';
import { Share, WriteModeElement, WriteMode } from './drivers/unraid-driver/file-manager/FileManager';
const { Log } = require('homey-log');

class UnraidRemoteApp extends Homey.App {
   homeyLog: any;

  async onInit() {
    this.homeyLog = new Log({ homey: this.homey });
    await this._initConditionCards();
    await this._initActionCards();
  }

  async _initConditionCards(): Promise<void> {
    await this._systemConditionCards();
    await this._containerConditionCards();
    await this._userScriptConditionCards();
    await this._vmConditionCards();
    await this._fileConditionCards();
  }

  async _initActionCards(): Promise<void> {
    await this._systemActionCards();
    await this._containerActionCards();
    await this._userScriptActionCards();
    await this._vmActionCards();
    await this._fileActionCards();
  }

  async _systemConditionCards(): Promise<void> {
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
  }

  async _containerConditionCards(): Promise<void> {
    //Container is running
    const containerRunningCondition = this.homey.flow.getConditionCard('container-is-running-condition');
    containerRunningCondition.registerArgumentAutocompleteListener('container', async (query, _args) => {
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

  async _userScriptConditionCards(): Promise<void> {
    //UserScript is running
    const userScriptRunningCondition = this.homey.flow.getConditionCard('user-script-is-running-condition');
    userScriptRunningCondition.registerArgumentAutocompleteListener('userscript', async (query, _args) => {
      const devices : Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const userScripts = await unraidDevice.userScriptList();
      return userScripts.filter((userScript) => {
        return userScript.name.toLowerCase().includes(query.toLowerCase());
      });
    });
    userScriptRunningCondition.registerRunListener(async (args) => {
      if(!args.userscript){
        throw new Error('UserScript is not set');
      }
      const userScript = args.userscript as UserScript;
      const devices : Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      return Promise.resolve(await unraidDevice.isUserScriptRunning(userScript.name));
    });
  }

  async _vmConditionCards(): Promise<void> {
    //VM is in a certain state
    const vmStateCondition = this.homey.flow.getConditionCard('vm-state-condition');
    vmStateCondition.registerArgumentAutocompleteListener('vm', async (query, _args) => {
      const devices : Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const vms = await unraidDevice.vmList();
      return vms.filter((vm) => {
        return vm.name.toLowerCase().includes(query.toLowerCase());
      });
    });
    vmStateCondition.registerArgumentAutocompleteListener('state', async (query, _args) => {
      const states : State[] = Object.keys(VMState).map((key) => ({
        name: key,
        description: VMState[key as keyof typeof VMState]
      }));
      return states.filter((state) => {
        return state.description.toLowerCase().includes(query.toLowerCase());
      });
    });
    vmStateCondition.registerRunListener(async (args) => {
      if(!args.vm){
        throw new Error('VM is not set');
      }
      if(!args.state){
        throw new Error('State is not set');
      }
      const vm = args.vm as VM;
      const state = args.state as State;
      const devices : Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found')
      }
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const vmState = await unraidDevice.getVMStatus(vm.name);
      return Promise.resolve(vmState === VMState[state.name as keyof typeof VMState]);
    });
  }

  async _fileConditionCards(): Promise<void> {
    const fileExistsCondition = this.homey.flow.getConditionCard('file-exists-condition');
    fileExistsCondition.registerArgumentAutocompleteListener('share', async (query, _args) => {
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if (devices.length === 0) {
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const shares : Share[] = await unraidDevice.getShares();
      return shares.filter((share) => {
        return share.name.toLowerCase().includes(query.toLowerCase());
      });
    })
    fileExistsCondition.registerRunListener(async (args) => {
      if(!args.share){
        throw new Error('Share is not set');
      }
      if(!args.file){
        throw new Error('file');
      }
      const share = args.share as Share;
      const file = args.file as string;
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if (devices.length === 0) {
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      return unraidDevice.fileExists(file, share.path);
    });
    const folderExistsCondition = this.homey.flow.getConditionCard('folder-exists-condition');
    folderExistsCondition.registerArgumentAutocompleteListener('share', async (query, _args) => {
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if (devices.length === 0) {
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const shares : Share[] = await unraidDevice.getShares();
      return shares.filter((share) => {
        return share.name.toLowerCase().includes(query.toLowerCase());
      });
    });
    folderExistsCondition.registerRunListener(async (args) => {
      if(!args.share){
        throw new Error('Share is not set');
      }
      if(!args.folder){
        throw new Error('folder');
      }
      const share = args.share as Share;
      const folder = args.folder as string;
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if (devices.length === 0) {
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      return unraidDevice.folderExists(folder, share.path);
    });
  }

  async _systemActionCards(): Promise<void> {
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
  }

  async _containerActionCards(): Promise<void> {
    //Start Container
    const startContainerAction = this.homey.flow.getActionCard('container-start');
    startContainerAction.registerArgumentAutocompleteListener('container', async (query, _args) => {
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
    stopContainerAction.registerArgumentAutocompleteListener('container', async (query, _args) => {
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
    toggleContainerAction.registerArgumentAutocompleteListener('container', async (query, _args) => {
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

  async _userScriptActionCards(): Promise<void> {
    //Execute UserScript in background
    const execUserScriptBGAction = this.homey.flow.getActionCard('execute-user-script-bg');
    execUserScriptBGAction.registerArgumentAutocompleteListener('userscript', async (query, _args) => {
      const devices : Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const userScripts = await unraidDevice.userScriptList();
      return userScripts.filter((userScript) => {
        return userScript.name.toLowerCase().includes(query.toLowerCase());
      });
    });
    execUserScriptBGAction.registerRunListener(async (args) => {
      if(!args.userscript){
        throw new Error('Container is not set');
      }
      const userScript = args.userscript as UserScript;
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      unraidDevice.startBackgroundUserScript(userScript.name)
    });
    //Execute UserScript in foreground
    const execUserScriptFGAction = this.homey.flow.getActionCard('execute-user-script-fg');
    execUserScriptFGAction.registerArgumentAutocompleteListener('userscript', async (query, _args) => {
      const devices : Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const userScripts = await unraidDevice.userScriptList();
      return userScripts.filter((userScript) => {
        return userScript.name.toLowerCase().includes(query.toLowerCase());
      });
    });
    execUserScriptFGAction.registerRunListener(async (args) => {
      if(!args.userscript){
        throw new Error('Container is not set');
      }
      const userScript = args.userscript as UserScript;
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      await unraidDevice.startForegroundUserScript(userScript.name)
    });
    //Execute UserScript in foreground and wait for the error code
    const execUserScriptFGActionAdv = this.homey.flow.getActionCard('execute-user-script-fg-adv');
    execUserScriptFGActionAdv.registerArgumentAutocompleteListener('userscript', async (query, _args) => {
      const devices : Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const userScripts = await unraidDevice.userScriptList();
      return userScripts.filter((userScript) => {
        return userScript.name.toLowerCase().includes(query.toLowerCase());
      });
    });
    execUserScriptFGActionAdv.registerRunListener(async (args) => {
      if(!args.userscript){
        throw new Error('Container is not set');
      }
      const userScript = args.userscript as UserScript;
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const outCode = await unraidDevice.startForegroundUserScript(userScript.name)
      return { code : outCode }
    });
    //Stop UserScript
    const stopUserScriptAction = this.homey.flow.getActionCard('user-script-stop');
    stopUserScriptAction.registerArgumentAutocompleteListener('userscript', async (query, _args) => {
      const devices : Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found');
      }
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const userScripts = await unraidDevice.userScriptList();
      return userScripts.filter((userScript) => {
        return userScript.name.toLowerCase().includes(query.toLowerCase());
      });
    });
    stopUserScriptAction.registerRunListener(async (args) => {
      if(!args.userscript){
        throw new Error('UserScript is not set');
      }
      const userScript = args.userscript as UserScript;
      const devices : Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found')
      }
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      await unraidDevice.stopUserScriptExecution(userScript.name);
    });
  }

  async _vmActionCards(): Promise<void> {
    //Start/Resume VM
    const startVMAction = this.homey.flow.getActionCard('vm-start-resume');
    startVMAction.registerArgumentAutocompleteListener('vm', async (query, _args) => {
      const devices : Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found')
      }
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const vms = await unraidDevice.vmList();
      return vms.filter((vm) => {
        return vm.name.toLowerCase().includes(query.toLowerCase());
      });
    });
    startVMAction.registerRunListener(async (args) => {
      if(!args.vm){
        throw new Error('VM is not set');
      }
      const vm = args.vm as VM;
      const devices : Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found')
      }
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      await unraidDevice.startOrResumeVM(vm.name);
    });
    //Shutdown VM
    const shutdownVMAction = this.homey.flow.getActionCard('vm-shutdown');
    shutdownVMAction.registerArgumentAutocompleteListener('vm', async (query, _args) => {
      const devices : Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found')
      }
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const vms = await unraidDevice.vmList();
      return vms.filter((vm) => {
        return vm.name.toLowerCase().includes(query.toLowerCase());
      });
    });
    shutdownVMAction.registerArgumentAutocompleteListener('mode', async (query, _args) => {
      const modes : Mode[] = [
        { name: 'acpi', description: 'acpi' },
        { name: 'agent', description: 'agent' },
        { name: 'initctl', description: 'initctl' },
        { name: 'signal', description: 'signal' },
        { name: 'paravirt', description: 'paravirt' }
      ];
      return modes.filter((mode) => {
        return mode.description.toLowerCase().includes(query.toLowerCase());
      });
    });
    shutdownVMAction.registerRunListener(async (args) => {
      if(!args.vm){
        throw new Error('VM is not set');
      }
      if(!args.mode){
        throw new Error('Mode is not set');
      }
      const vm = args.vm as VM;
      const mode = args.mode as Mode;
      const devices : Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found')
      }
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      await unraidDevice.stopVM(vm.name, mode.name as IVMShutdownModes);
    });
    //Pause VM
    const pauseVMAction = this.homey.flow.getActionCard('vm-pause');
    pauseVMAction.registerArgumentAutocompleteListener('vm', async (query, _args) => {
      const devices : Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found')
      }
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const vms = await unraidDevice.vmList();
      return vms.filter((vm) => {
        return vm.name.toLowerCase().includes(query.toLowerCase());
      });
    });
    pauseVMAction.registerRunListener(async (args) => {
      if(!args.vm){
        throw new Error('VM is not set');
      }
      const vm = args.vm as VM;
      const devices : Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found')
      }
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      await unraidDevice.pauseVM(vm.name);
    });
    //Reboot VM
    const rebootVMAction = this.homey.flow.getActionCard('vm-reboot');
    rebootVMAction.registerArgumentAutocompleteListener('vm', async (query, _args) => {
      const devices : Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found')
      }
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const vms = await unraidDevice.vmList();
      return vms.filter((vm) => {
        return vm.name.toLowerCase().includes(query.toLowerCase());
      });
    });
    rebootVMAction.registerArgumentAutocompleteListener('mode', async (query, _args) => {
      const modes : Mode[] = [
        { name: 'acpi', description: 'acpi' },
        { name: 'agent', description: 'agent' },
        { name: 'initctl', description: 'initctl' }
      ];
      return modes.filter((mode) => {
        return mode.description.toLowerCase().includes(query.toLowerCase());
      });
    });
    rebootVMAction.registerRunListener(async (args) => {
      if(!args.vm){
        throw new Error('VM is not set');
      }
      if(!args.mode){
        throw new Error('Mode is not set');
      }
      const vm = args.vm as VM;
      const mode = args.mode as Mode;
      const devices : Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found')
      }
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      await unraidDevice.rebootVM(vm.name, mode.name as IVMRebootModes);
    });
  }

  async _fileActionCards(): Promise<void> {
    const readFileAction = this.homey.flow.getActionCard('file-read');
    readFileAction.registerArgumentAutocompleteListener('share', async (query, _args) => {
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if (devices.length === 0) {
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const shares : Share[] = await unraidDevice.getShares();
      return shares.filter((share) => {
        return share.name.toLowerCase().includes(query.toLowerCase());
      });
    });
    readFileAction.registerRunListener(async (args) => {
      if(!args.share){
        throw new Error('Share is not set');
      }
      if(!args.file){
        throw new Error('file');
      }
      const share = args.share as Share;
      const file = args.file as string;
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if (devices.length === 0) {
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const fileExists: boolean = await unraidDevice.fileExists(file, share.path);
      if(!fileExists){
        throw new Error('File does not exist');
      }
      const out = await unraidDevice.readFile(file, share.path);
      return {
        content: out
      };
    });
    //Read folder
    const readFolderAction = this.homey.flow.getActionCard('folder-read');
    readFolderAction.registerArgumentAutocompleteListener('share', async (query, _args) => {
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if (devices.length === 0) {
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const shares : Share[] = await unraidDevice.getShares();
      return shares.filter((share) => {
        return share.name.toLowerCase().includes(query.toLowerCase());
      });
    });
    readFolderAction.registerRunListener(async (args) => {
      if(!args.share){
        throw new Error('Share is not set');
      }
      if(!args.folder){
        throw new Error('folder');
      }
      const share = args.share as Share;
      const folder = args.folder as string;
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if (devices.length === 0) {
        throw new Error('No devices found');
      }
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const folderExists: boolean = await unraidDevice.folderExists(folder, share.path);
      if(!folderExists){
        throw new Error('Folder does not exist');
      }
      const out = await unraidDevice.readFolder(folder, share.path);
      return {
        content: JSON.stringify(out)
      };
    });
    //Create empty file
    const createEmptyFileAction = this.homey.flow.getActionCard('file-create');
    createEmptyFileAction.registerArgumentAutocompleteListener('share', async (query, _args) => {
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if (devices.length === 0) {
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const shares : Share[] = await unraidDevice.getShares();
      return shares.filter((share) => {
        return share.name.toLowerCase().includes(query.toLowerCase());
      });
    });
    createEmptyFileAction.registerRunListener(async (args) => {
      if(!args.share){
        throw new Error('Share is not set');
      }
      if(!args.file){
        throw new Error('Filename is not set');
      }
      const share = args.share as Share;
      const file = args.file as string;
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if (devices.length === 0) {
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const fileExists: boolean = await unraidDevice.fileExists(file, share.path);
      if(fileExists){
        throw new Error('File already exists');
      }
      const isCreated = await unraidDevice.createFile(file, share.path, undefined);
      if(!isCreated){
        throw new Error('File could not be created');
      }
    });
    //Create file with content
    const createFileAction = this.homey.flow.getActionCard('file-with-content-create');
    createFileAction.registerArgumentAutocompleteListener('share', async (query, _args) => {
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if (devices.length === 0) {
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const shares : Share[] = await unraidDevice.getShares();
      return shares.filter((share) => {
        return share.name.toLowerCase().includes(query.toLowerCase());
      });
    });
    createFileAction.registerRunListener(async (args) => {
      if(!args.share){
        throw new Error('Share is not set');
      }
      if(!args.file){
        throw new Error('Filename is not set');
      }
      if(!args.content){
        throw new Error('Content is not set');
      }
      const share = args.share as Share;
      const file = args.file as string;
      const content = args.content as string;
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if (devices.length === 0) {
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const fileExists: boolean = await unraidDevice.fileExists(file, share.path);
      if(fileExists){
        throw new Error('File already exists');
      }
      const isCreated: boolean = await unraidDevice.createFile(file, share.path, content);
      if(!isCreated){
        throw new Error('File could not be created');
      }
    });
    //Write a file with content
    const writeFileAction = this.homey.flow.getActionCard('file-write');
    writeFileAction.registerArgumentAutocompleteListener('share', async (query, _args) => {
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if (devices.length === 0) {
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const shares : Share[] = await unraidDevice.getShares();
      return shares.filter((share) => {
        return share.name.toLowerCase().includes(query.toLowerCase());
      });
    });
    writeFileAction.registerArgumentAutocompleteListener('mode', async (query, _args) => {
      const modes :WriteModeElement[] = [
        { name: 'append', value: WriteMode.APPEND },
        { name: 'overwrite', value: WriteMode.OVERWRITE }
      ];
      return modes.filter((mode) => {
        return mode.name.toLowerCase().includes(query.toLowerCase());
      });
    });
    writeFileAction.registerRunListener(async (args) => {
      if(!args.share){
        throw new Error('Share is not set');
      }
      if(!args.file){
        throw new Error('Filename is not set');
      }
      if(!args.content){
        throw new Error('Content is not set');
      }
      if(!args.mode){
        throw new Error('Mode is not set');
      }
      const share = args.share as Share;
      const file = args.file as string;
      const content = args.content as string;
      const mode = args.mode as WriteModeElement;
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if (devices.length === 0) {
        throw new Error('No devices found');
      }
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const isWritten = await unraidDevice.writeFile(file, content,share.path, mode.value);
      if(!isWritten){
        throw new Error('File could not be written');
      }
    });
    //Erase the file content
    const eraseFileAction = this.homey.flow.getActionCard('file-content-erase');
    eraseFileAction.registerArgumentAutocompleteListener('share', async (query, _args) => {
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if (devices.length === 0) {
        throw new Error('No devices found');
      }
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const shares : Share[] = await unraidDevice.getShares();
      return shares.filter((share) => {
        return share.name.toLowerCase().includes(query.toLowerCase());
      });
    });
    eraseFileAction.registerRunListener(async (args) => {
      if(!args.share){
        throw new Error('Share is not set');
      }
      if(!args.file){
        throw new Error('Filename is not set');
      }
      const share = args.share as Share;
      const file = args.file as string;
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if (devices.length === 0) {
        throw new Error('No devices found');
      }
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const fileExists: boolean = await unraidDevice.fileExists(file, share.path);
      if(!fileExists){
        throw new Error('File does not exist');
      }
      const isErased = await unraidDevice.truncateFile(file, share.path);
      if(!isErased){
        throw new Error('File could not be erased');
      }
    });
    //Delete a file
    const deleteFileAction = this.homey.flow.getActionCard('file-delete');
    deleteFileAction.registerArgumentAutocompleteListener('share', async (query, _args) => {
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if (devices.length === 0) {
        throw new Error('No devices found');
      }
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const shares : Share[] = await unraidDevice.getShares();
      return shares.filter((share) => {
        return share.name.toLowerCase().includes(query.toLowerCase());
      });
    });
    deleteFileAction.registerRunListener(async (args) => {
      if(!args.share){
        throw new Error('Share is not set');
      }
      if(!args.file){
        throw new Error('Filename is not set');
      }
      const share = args.share as Share;
      const file = args.file as string;
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if (devices.length === 0) {
        throw new Error('No devices found');
      }
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const fileExists: boolean = await unraidDevice.fileExists(file, share.path);
      if(!fileExists){
        throw new Error('File does not exist');
      }
      const isDeleted = await unraidDevice.deleteFile(file, share.path);
      if(!isDeleted){
        throw new Error('File could not be deleted');
      }
    });
    //Create a folder
    const createFolderAction = this.homey.flow.getActionCard('folder-create');
    createFolderAction.registerArgumentAutocompleteListener('share', async (query, _args) => {
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found');
      }
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const shares : Share[] = await unraidDevice.getShares();
      return shares.filter((share) => {
        return share.name.toLowerCase().includes(query.toLowerCase());
      });
    });
    createFolderAction.registerRunListener(async (args) => {
      if(!args.share){
        throw new Error('Share is not set');
      }
      if(!args.folder){
        throw new Error('Folder is not set');
      }
      const share = args.share as Share;
      const folder = args.folder as string;
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found');
      }
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const folderExists: boolean = await unraidDevice.folderExists(folder, share.path);
      if(folderExists){
        throw new Error('Folder already exists');
      }
      const isCreated = await unraidDevice.createFolder(folder, share.path);
      if(!isCreated){
        throw new Error('Folder could not be created');
      }
    });
    //Delete a folder
    const deleteFolderAction = this.homey.flow.getActionCard('folder-delete');
    deleteFolderAction.registerArgumentAutocompleteListener('share', async (query, _args) => {
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if (devices.length === 0) {
        throw new Error('No devices found');
      }
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const shares : Share[] = await unraidDevice.getShares();
      return shares.filter((share) => {
        return share.name.toLowerCase().includes(query.toLowerCase());
      });
    });
    deleteFolderAction.registerRunListener(async (args) => {
      if(!args.share){
        throw new Error('Share is not set');
      }
      if(!args.folder){
        throw new Error('Folder is not set');
      }
      const share = args.share as Share;
      const folder = args.folder as string;
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if (devices.length === 0) {
        throw new Error('No devices found');
      }
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      const folderExists: boolean = await unraidDevice.folderExists(folder, share.path);
      if(!folderExists){
        throw new Error('Folder does not exist');
      }
      const isDeleted = await unraidDevice.deleteFolder(folder, share.path);
      if(!isDeleted){
        throw new Error('Folder could not be deleted');
      }
    });
  }
}

module.exports = UnraidRemoteApp;
export { UnraidRemoteApp };