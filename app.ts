import Homey from 'homey';
import { APIDefinition, APIDefinition_Description, APIError, APIError_Description, APIOutput, APIOutput_Descrption, APIAction, ContainerActionEnum, Container_Description, ISystemStats_Description, convertToUnraidUptime, isNonEmpty, logErrorToSentry, UserScript_Description, UserScriptActionEnum, VirtualMachine_Description, VMActionEnum, Share_Description, FileActionEnum, FolderActionEnum } from './utils/utilites';
import { UnraidRemoteDevice } from './drivers/unraid-driver/device';
import { Container } from './drivers/unraid-driver/unraid-remote/utils/IDockerContainer';
import { UserScript } from './drivers/unraid-driver/unraid-remote/utils/IUserScript';
import { VM, VMState } from '@ridenui/unraid/dist/modules/vms/vm';
import { State, Mode, VirtualMachine } from './drivers/unraid-driver/unraid-remote/utils/IVirtualMachine';
import { IVMRebootModes, IVMShutdownModes } from '@ridenui/unraid/dist/modules/vms/vm';
import { Share, WriteModeElement, WriteMode } from './drivers/unraid-driver/file-manager/FileManager';
import { unraid } from '@ridenui/unraid/dist/instance';
import { ISSHCommandOutput, ISystemStats } from './drivers/unraid-driver/unraid-remote/utils/ISystemStats';
import { parseArgs } from 'util';
const { Log } = require('homey-log');

export class UnraidRemoteApp extends Homey.App {
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
      return Promise.resolve(await unraidDevice.isContainerRunning(container.name));
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
      unraidDevice.startContainer(container.name);
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
      unraidDevice.stopContainer(container.name);
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
      const isOnline : boolean = await unraidDevice.isContainerRunning(container.name);
      isOnline ? unraidDevice.stopContainer(container.name) : unraidDevice.startContainer(container.name);
    });
    const execContainerAction = this.homey.flow.getActionCard('container-exec');
    execContainerAction.registerArgumentAutocompleteListener('container', async (query, _args) => {
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
    execContainerAction.registerRunListener(async (args) => {
      if(!args.container){
        throw new Error('Container is not set');
      }
      if(!args.command){
        throw new Error('Command is not set');
      }
      const container = args.container as Container;
      const command = args.command as string;
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      unraidDevice.dockerExecNoWait(container.name, command);
    });
    const execContainerAdvAction = this.homey.flow.getActionCard('container-exec-adv');
    execContainerAdvAction.registerArgumentAutocompleteListener('container', async (query, _args) => {
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
    execContainerAdvAction.registerRunListener(async (args) => {
      if(!args.container){
        throw new Error('Container is not set');
      }
      if(!args.command){
        throw new Error('Command is not set');
      }
      const container = args.container as Container;
      const command = args.command as string;
      const flagsStr = args.flags as string | undefined;
      const flags = (typeof flagsStr === 'undefined') ? [] : flagsStr?.split(' ');
      const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
      if(devices.length === 0){
        throw new Error('No devices found');
      }
      //at moment only one device is supported
      const unraidDevice = devices[0] as UnraidRemoteDevice;
      try {
        return await unraidDevice.dockerExec(container.name, command, flags);
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

  /*API*/
  public async getAvailableApiList(): Promise<APIDefinition[]> {
    let apiList: APIDefinition[] = [];
    apiList.push({
      method: 'GET',
      path: '/operationList',
      description: 'Get all available operations',
      output: 'APIDefinition[]'
    });
    apiList.push({
      method: 'GET',
      path: '/datatypeInfo/:datatype',
      description: 'Get informations about the given datatype',
      output: 'string | APIError'
    });
    apiList.push({
      method: 'GET',
      path: '/systemInfo',
      description: 'Get statistics about unraid server',
      output: 'ISystemStats | APIError'
    });
    apiList.push({
      method: 'POST',
      path: '/shellExec',
      description: 'Execute a shell command',
      body: {
        'command': 'The command to be executed',
        'runInBackground': 'If set to true, the command will be executed in background. Default: false'
      },
      output: 'APIOutput | APIError'
    });
    apiList.push({
      method: 'GET',
      path: '/shares',
      description: 'Get the list of available shares',
      output: 'Share[] | APIError'
    });
    apiList.push({
      method: 'POST',
      path: '/fileAction',
      description: 'Execute an operation on the specified file',
      body: {
        'action': `The action to be done. Allowed values: [${Object.values(FileActionEnum).join(' ,')}]`,
        'share_name': 'The share name',
        'file_name': 'The file name',
        'content': 'The content of the file. Optional for CREATE action. If not set, the file will be empty',
        'mode': 'The write mode. Mandatory for WRITE action. Allowed values: [append, overwrite]'
      },
      output: 'APIOutput | APIError'
    });
    apiList.push({
      method: 'POST',
      path: '/folderAction',
      description: 'Execute an operation on the specified folder',
      body: {
        'action': `The action to be done. Allowed values: [${Object.values(FolderActionEnum).join(' ,')}]`,
        'share_name': 'The share name',
        'folder_name': 'The folder name'
      },
      output: 'APIOutput | APIError'
    });
    apiList.push({
      method: 'GET',
      path: '/dockerManagement/containerList',
      query: {
        'online': 'If specifed, allow to filter the container output list by online status.'
      },
      description: 'Get information about the docker containers',
      output: 'Container[] | APIError',
    });
    apiList.push({
      method: 'POST',
      path: '/dockerManagement/action',
      description: 'Execute an operation on the specified container',
      body: {
        'container_id': 'The container ID. One between container_id and container_name must be set',
        'container_name': 'The container name. One between container_id and container_name must be set',
        'action': `The action to be done. Allowed values: [${Object.values(ContainerActionEnum).join(' ,')}]`,
        'runInBackground': 'If set to true, the operation will be executed in background. Default: false',
        'params': `Needed for EXEC action. An object containing {'flags' : string[], 'command': string} flags -> an array of strings, each element is a flag. command -> the command to be executed`
      },
      output: 'APIOutput | APIError'
    });
    apiList.push({
      method: 'GET',
      path: '/userScript/scriptList',
      description: 'Get the list of available user scripts',
      output: 'UserScript[] | APIError'
    });
    apiList.push({
      method: 'POST',
      path: '/userScript/action',
      description: 'Execute an operation on the specified user script',
      body:{
        'user_script_name' : 'The user script name',
        'runInBackground': 'If set to true, the operation will be executed in background. Default: false',
        'action': `The action to be done. Allowed values: [${Object.values(UserScriptActionEnum).join(' ,')}]`
      },
      output: 'APIOutput | APIError'
    });
    apiList.push({
      method: 'GET',
      path: '/vm/vmList',
      description: 'Get the list of available VMs',
      output: 'VirtualMachine[] | APIError'
    });
    apiList.push({
      method: 'POST',
      path: '/vm/action',
      description: 'Execute an operation on the specified VM',
      body:{
        'virtual_machine_name' : 'The VM name',
        'action': `The action to be done. Allowed values: [${Object.values(VMActionEnum).join(' ,')}]`
      },
      output: 'APIOutput | APIError'
    });
    return apiList;
  }

  public async getDatatypeInfo(datatype: string): Promise<string> {
    switch (datatype.toUpperCase()) {
      case 'APIDEFINITION':
        return JSON.stringify(APIDefinition_Description);
      case 'APIERROR':
        return JSON.stringify(APIError_Description);
      case 'APIOUTPUT':
        return JSON.stringify(APIOutput_Descrption);
      case 'SHARE':
        return JSON.stringify(Share_Description);
      case 'CONTAINER':
        return JSON.stringify(Container_Description);
      case 'ISYSTEMSTATS':
        return JSON.stringify(ISystemStats_Description);
      case 'USERSCRIPT':
        return JSON.stringify(UserScript_Description);
      case 'VIRTUALMACHINE': {
        return JSON.stringify(VirtualMachine_Description);
      }
      default:
        return 'Unknown datatype';
    }
  }

  public async getSystemInfo(): Promise<ISystemStats | APIError> {
    const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
    if (devices.length === 0) {
      return {error: "No devices", code: -1};
    }
    const unraidDevice = devices[0] as UnraidRemoteDevice;
    try{
      return await unraidDevice.getSystemInfo();
    } catch(error){
      return {error: "Error getting system statistics: "+ JSON.stringify(error), code: -2};
    }
  }

  public async getShares(): Promise<Share[] | APIError> {
    const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
    if (devices.length === 0) {
      return {error: "No devices", code: -1};
    }
    const unraidDevice = devices[0] as UnraidRemoteDevice;
    try{
      return await unraidDevice.getShares();
    } catch(error){
      return {error: "Error getting shares: "+ JSON.stringify(error), code: -2};
    }
  }

  public async doFileAction(fileAction: APIAction): Promise<APIOutput | APIError> {
    const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
    if (devices.length === 0) {
      return {error: "No devices", code: -1};
    }
    const unraidDevice = devices[0] as UnraidRemoteDevice;
    let operationDone : boolean = false;
    let params: any[] = [];
    const shares = await unraidDevice.getShares();
    const share = shares.find((share) => share.name.toUpperCase() === fileAction.share_name?.toUpperCase());
    try{
      switch (fileAction.action) {
        case FileActionEnum.READ:
          if(!fileAction.file_name || !share) return {error: "Share and file must be not null", code: -2};
          const fileContent = await unraidDevice.readFile(fileAction.file_name, share?.path);
          operationDone = true;
          params.push({content: fileContent});
          break;
        case FileActionEnum.DELETE:
          if(!fileAction.file_name || !share) return {error: "Share and file must be not null", code: -2};
          operationDone = await unraidDevice.deleteFile(fileAction.file_name, share?.path);
          break;
        case FileActionEnum.CREATE:
          if(!fileAction.file_name || !share) return {error: "Share and file must be not null", code: -2};
          let content : string | undefined = undefined;
          if(typeof fileAction.params !== 'undefined' && typeof fileAction.params?.file_content !== 'undefined' && isNonEmpty(fileAction.params?.file_content)){
            content = fileAction.params!.file_content;
          }
          operationDone = await unraidDevice.createFile(fileAction.file_name, share?.path, content);
          break;
        case FileActionEnum.WRITE:
          if(!fileAction.file_name || !share || !fileAction.params || !fileAction.params?.file_content || !fileAction.params?.mode) return {error: "Share, file, content and mode must be not null", code: -2};
          operationDone = await unraidDevice.writeFile(fileAction.file_name, fileAction.params.file_content, share?.path, fileAction.params.mode);
          break;
        case FileActionEnum.TRUNCATE:
          if(!fileAction.file_name || !share) return {error: "Share and file must be not null", code: -2};
          operationDone = await unraidDevice.truncateFile(fileAction.file_name, share?.path);
          break;
        default:
          return {error: `Unknown file action ${fileAction.action}`, code: -3};
      }
    }catch(error){
      return {error: "Error executing file action: "+ JSON.stringify(error), code: -2};
    }
    return {operationDone: operationDone, message: `The operation ${fileAction.action} is done. Check operationDone`, params: params};
  }

  public async doFolderAction(folderAction: APIAction): Promise<APIOutput | APIError> {
    const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
    if (devices.length === 0) {
      return {error: "No devices", code: -1};
    }
    const unraidDevice = devices[0] as UnraidRemoteDevice;
    let operationDone : boolean = false;
    let params: any[] = [];
    const shares = await unraidDevice.getShares();
    const share = shares.find((share) => share.name.toUpperCase() === folderAction.share_name?.toUpperCase());
    try{
      switch (folderAction.action) {
        case FolderActionEnum.DELETE:
          if(!folderAction.folder_name || !share) return {error: "Share and folder must be not null", code: -2};
          operationDone = await unraidDevice.deleteFolder(folderAction.folder_name, share?.path);
          break;
        case FolderActionEnum.CREATE:
          if(!folderAction.folder_name || !share) return {error: "Share and folder must be not null", code: -2};
          operationDone = await unraidDevice.createFolder(folderAction.folder_name, share?.path);
          break;
        case FolderActionEnum.READ:
          if(!folderAction.folder_name || !share) return {error: "Share and folder must be not null", code: -2};
          const folderContent = await unraidDevice.readFolder(folderAction.folder_name, share?.path);
          operationDone = true;
          params.push({content: folderContent});
          break;
        default:
          return {error: `Unknown folder action ${folderAction.action}`, code: -3};
      }
    }catch(error){
      return {error: "Error executing folder action: "+ JSON.stringify(error), code: -2};
    }
    return {operationDone: operationDone, message: `The operation ${folderAction.action} is done. Check operationDone`, params: params};
  }

  public async doExecShell(shellAction: APIAction): Promise<APIOutput | APIError>{
    let runInBackground : boolean = false;
    if(typeof shellAction.runInBackground != 'undefined' && shellAction.runInBackground != null){
      runInBackground = shellAction.runInBackground;
    }
    if(!shellAction.command || typeof shellAction.command === 'undefined' || shellAction.command.trim().length == 0){
      return { error: "command must be not null", code: -2 };
    }
    let shellCommand : string = shellAction.command!.trim();
    const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
    if (devices.length === 0) {
      return {error: "No devices", code: -1};
    }
    const unraidDevice = devices[0] as UnraidRemoteDevice;
    let operationDone : boolean = false;
    let params: any[] = [];
    try{
      if(runInBackground){
        unraidDevice.executeShellCommand(shellCommand);
        return {operationDone: true, message: `The operation will be executed in background`};
      } else {
        const output: ISSHCommandOutput = await unraidDevice.executeShellCommand(shellCommand);
        operationDone = output.code == 0;
        params.push(output);
      }
    } catch(error){
      return {error: "Error executing shell command: "+ JSON.stringify(error), code: -2};
    }
    return {operationDone: operationDone, message: `The operation ${shellCommand} was successful`, params: params};
  }

  public async getContainerList(online?: boolean) : Promise<Container[] | APIError> {
    const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
    if (devices.length === 0) {
      return {error: "No devices", code: -1};
    }
    const unraidDevice = devices[0] as UnraidRemoteDevice;
    try{
      const containers = await unraidDevice.containerList();
      if(typeof online != 'undefined'){
        if(online) return containers.filter((container) => container.status.toUpperCase().includes('UP'));
        return containers.filter((container) => !container.status.toUpperCase().includes('UP'));
      }
      return containers;
    } catch(error){
      return {error: "Error getting container list: "+ JSON.stringify(error), code: -2};
    }
  }

  public async doContainerAction(containerAction: APIAction): Promise<APIOutput | APIError> {
    const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
    if (devices.length === 0) {
      return {error: "No devices", code: -1};
    }
    const unraidDevice = devices[0] as UnraidRemoteDevice;
    let containers: Container[] = [];
    try{
      containers = await unraidDevice.containerList();
    } catch(error){
      return {error: "Error getting container list: "+ JSON.stringify(error), code: -2};
    }
    let container: Container | undefined = undefined;
    let containerReference : string | undefined = undefined;
    let runInBackground : boolean = false;
    if(typeof containerAction.runInBackground != 'undefined' && containerAction.runInBackground != null){
      runInBackground = containerAction.runInBackground;
    }
    if(typeof containerAction.container_id != 'undefined'){
      containerReference = containerAction.container_id;
      container = containers.find( c => c.id == containerAction.container_id);
    } else {
      containerReference = containerAction.container_name;
      container = containers.find( c=> c.name.toUpperCase() == containerAction.container_name?.toUpperCase());
    }
    if(typeof container == 'undefined') return {error: `No docker container found with name/id ${containerReference}`, code: -3};
    let operationDone : boolean = false;
    let params: any[] = [];
    switch (containerAction.action) {
      case ContainerActionEnum.TURN_ON:
        if(container.status.toUpperCase().includes("UP")) return {operationDone: false, message: `The container ${container.name} is already running..`};
        if(runInBackground){
          unraidDevice.startContainer(container.name);
          return {operationDone: true, message: `The operation ${containerAction.action} will be executed in background`};
        }
        operationDone = await unraidDevice.startContainer(container.name);
        break;
      case ContainerActionEnum.TURN_OFF:
        if(!container.status.toUpperCase().includes("UP")) return {operationDone: false, message: `The container ${container.name} isn't running..`};
        if(runInBackground){
          unraidDevice.stopContainer(container.name);
          return {operationDone: true, message: `The operation ${containerAction.action} will be executed in background`};
        }
        operationDone = await unraidDevice.stopContainer(container.name);
        break;
      case ContainerActionEnum.EXEC:
        if(!container.status.toUpperCase().includes("UP")) return {operationDone: false, message: `The container ${container.name} isn't running..`};
        if(typeof containerAction.params === 'undefined' || typeof containerAction.params?.command === 'undefined' || !isNonEmpty(containerAction.params?.command))
          return {operationDone: false, message: `Parameters are mandatory: {'flags': [], 'command': ''}`};
        const commandToBeExec = containerAction.params?.command;
        let flags: string[] = [];
        if(typeof containerAction.params?.flags !== 'undefined' && containerAction.params?.flags !== null){
          flags = containerAction.params?.flags as string[];
        }
        if(runInBackground){
          unraidDevice.dockerExec(container.name, commandToBeExec, flags);
          return {operationDone: true, message: `The operation ${containerAction.action} will be executed in background`};
        }
        const output: ISSHCommandOutput = await unraidDevice.dockerExec(container.name, commandToBeExec, flags);
        operationDone = output.code == 0;
        params.push(output);
        break;
      default:
        return {error: `The specified action (${containerAction.action}) is not supported!`, code: -4};
    }
    return {operationDone: operationDone, message: `The operation ${containerAction.action} on container ${container.name} was successful`, params: params};
  }

  public async getUserScriptList(): Promise<UserScript[] | APIError> {
    const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
    if (devices.length === 0) {
      return {error: "No devices", code: -1};
    }
    const unraidDevice = devices[0] as UnraidRemoteDevice;
    try{
      return await unraidDevice.userScriptList();
    } catch(error){
      return {error: "Error getting user script list: "+ JSON.stringify(error), code: -2};
    }
  }

  public async doUserScriptAction(userScriptAction: APIAction): Promise<boolean | APIError> {
    let operationDone = false;
    let userScripts : UserScript[] = [];
    const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
    if (devices.length === 0) {
      return {error: "No devices", code: -1};
    }
    const unraidDevice = devices[0] as UnraidRemoteDevice;
    try{
      userScripts = await unraidDevice.userScriptList();
    } catch(error){
      return {error: "Error getting user script list: "+ JSON.stringify(error), code: -2};
    }
    let userScript: UserScript | undefined = userScripts.find( u => u.name.toUpperCase() == userScriptAction.user_script_name?.toUpperCase());
    if(typeof userScript == 'undefined' || userScript == null) return {error: `No user script found with name ${userScriptAction.user_script_name}`, code: -3};
    let runInBackground : boolean = false;
    if(typeof userScriptAction.runInBackground != 'undefined' && userScriptAction.runInBackground != null){
      runInBackground = userScriptAction.runInBackground;
    }
    const isRunning = await unraidDevice.isUserScriptRunning(userScript.name);
    switch (userScriptAction.action as UserScriptActionEnum) {
      case UserScriptActionEnum.IS_RUNNING:
        operationDone = isRunning;
        break;
      case UserScriptActionEnum.START:
        if(isRunning) return {error: `The user script ${userScript.name} is already running`, code: -3};
        if(runInBackground){
          unraidDevice.startBackgroundUserScript(userScript.name);
          operationDone = true;
        } else {
          let code: number = await unraidDevice.startForegroundUserScript(userScript.name);
          operationDone = code == 0;
        }
        break;
      case UserScriptActionEnum.STOP:
        if(!isRunning) return {error: `The user script ${userScript.name} is not running`, code: -3};
        operationDone = await unraidDevice.stopUserScriptExecution(userScript.name);
        break;
      default:
        return {error: `The specified action (${userScriptAction.action}) is not supported!`, code: -4};
    }
    return operationDone;
  }

  public async getVMList(): Promise<VirtualMachine[] | APIError> {
    const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
    if (devices.length === 0) {
      return {error: "No devices", code: -1};
    }
    const unraidDevice = devices[0] as UnraidRemoteDevice;
    try{
      return await unraidDevice.vmList();
    } catch(error){
      return {error: "Error getting VM list: "+ JSON.stringify(error), code: -2};
    }
  }

  public async doVMAction(vmAction: APIAction): Promise<boolean | APIError> {
    let operationDone = false;
    let vms : VirtualMachine[] = [];
    const devices: Homey.Device[] = this.homey.drivers.getDriver('unraid-driver').getDevices();
    if (devices.length === 0) {
      return {error: "No devices", code: -1};
    }
    const unraidDevice = devices[0] as UnraidRemoteDevice;
    try{
      vms = await unraidDevice.vmList();
    } catch(error){
      return {error: "Error getting VM list: "+ JSON.stringify(error), code: -2};
    }
    let vm: VirtualMachine | undefined = vms.find( v => v.name.toUpperCase() == vmAction.virtual_machine_name?.toUpperCase());
    if(typeof vm == 'undefined' || vm == null) return {error: `No VM found with name ${vmAction.virtual_machine_name}`, code: -3};
    let runInBackground : boolean = false;
    if(typeof vmAction.runInBackground != 'undefined' && vmAction.runInBackground != null){
      runInBackground = vmAction.runInBackground;
    }
    switch (vmAction.action as VMActionEnum) {
      case VMActionEnum.START || VMActionEnum.RESUME:
        if(vm.state == VMState.RUNNING) return {error: `The VM ${vm.name} is already running`, code: -3};
        if(runInBackground){
          unraidDevice.startOrResumeVM(vm.name);
          operationDone = true;
        } else {
          operationDone = await unraidDevice.startOrResumeVM(vm.name);
        }
        break;
      case VMActionEnum.STOP:
        if(vm.state == VMState.STOPPED) return {error: `The VM ${vm.name} is already stopped`, code: -3};
        if(runInBackground){
          unraidDevice.stopVM(vm.name, 'acpi');
          operationDone = true;
        } else {
          operationDone = await unraidDevice.stopVM(vm.name, 'acpi');
        }
        break;
      case VMActionEnum.PAUSE:
        if(vm.state == VMState.PAUSED) return {error: `The VM ${vm.name} is already paused`, code: -3};
        if(runInBackground){
          unraidDevice.pauseVM(vm.name);
          operationDone = true;
        } else {
          operationDone = await unraidDevice.pauseVM(vm.name);
        }
        break;
      case VMActionEnum.REBOOT:
        if(vm.state != VMState.RUNNING && vm.state != VMState.PAUSED) return {error: `The VM ${vm.name} is not running`, code: -3};
        if(runInBackground){
          unraidDevice.rebootVM(vm.name, 'acpi');
          operationDone = true;
        } else {
          operationDone = await unraidDevice.rebootVM(vm.name, 'acpi');
        }
        break;
      default:
        return {error: `The specified action (${vmAction.action}) is not supported!`, code: -4};
    }
    return operationDone;
  }
  
}

module.exports = UnraidRemoteApp;