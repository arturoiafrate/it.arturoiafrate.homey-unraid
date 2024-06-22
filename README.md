# Unraid

Unofficial [unraid](https://unraid.net/) integration for Homey.
This integration allows you to manage and monitor your unraid (local or remote) server.

### How does it works?
Install the app and add a new unraid device. Open the device settings and configure:
- Host > the hostname/ip address of your Unraid NAS
- Username > a valid user on your Unraid Server. You can also use the root user.
- Password > the user password
- Port > the port for SSH connection. Default: 22
- Ping interval > the ping interval (in seconds). Used to check if the Unraid server is online. Default: 3
- MAC address > the mac address of your Unraid Server. If is set and your unraid server is on your LAN, you can send a magic packet (WOL) to wake up the NAS.
- Check interval > the refresh interval (in seconds) of all sensors.

### What you can do?
1. Actually you can monitor:
    - CPU usage
    - RAM usage
    - Array usage
    - The system uptime
    - Containers online status changes

2. Actually you can check:
    - If the CPU usage is over/under a threshold
    - If the Array usage is over/under a threshold
    - If the RAM usage is over/under a threshold
    - If the system uptime is over/under a threshold
    - If a specific container is running
    - If a specific userscript is running in background
    - If a specific VM is in a certain state
    - If a file exists in a share
    - If a folder exists in a share

3. Actually you can do:
    - Execute a generic SSH command
    - Execute a generic SSH command and wait for the output (Advanced Flow)
    - Start/Stop/Toggle existing docker containers
    - Execute a command inside a docker container (detached and interactive)
    - Execute a user script (background or foreground [and wait for the output - Advanced Flow])
    - Stop a user script if it's running in background
    - Start/Resume a VM
    - Pause/Shutdown/Reboot a VM
    - Create/Delete a folder in a share
    - Read a folder content as a JSON (Advanced Flow)
    - Create a file (with or without content) in a share
    - Delete a file or it's content in a share
    - Write inside an existing file in a share (overwrite/append mode supported)
    - Read a file in a share and get the content (Advanced Flow)


For each one of them you can trigger a flow. For example:
**_When_ CPU Usage is changed _and_ CPU Usage is over a _threshold_, _execute_ something.**

You can do everything via flow cards or via API

#### API Documentation

##### Operation List
This API return informations about available APIs.

_method_ `GET`<br>
_path_ `/operationList`<br>
_output_ `APIDefinition[]`

**Example**
```
const unraidApp = await Homey.apps.getApp({ id:"it.arturoiafrate.h-unraid-integration" });
const output = await unraidApp.get({ path: '/operationList'});
```


##### DataType Info
This API return informations about datatypes

_method_ `GET`<br>
_path_ `/datatypeInfo/:datatype`<br>
_output_ `string | APIError`

**Example**
```
const unraidApp = await Homey.apps.getApp({ id:"it.arturoiafrate.h-unraid-integration" });
const output = await unraidApp.get({ path: '/datatypeInfo/APIDefinition'});
```


##### System Information
This API return informations the system

_method_ `GET`<br>
_path_ `/systemInfo`<br>
_output_ `ISystemStats | APIError`

**Example**
```
const unraidApp = await Homey.apps.getApp({ id:"it.arturoiafrate.h-unraid-integration" });
const output = await unraidApp.get({ path: '/systemInfo'});
```


##### Shell Exec
This API allows to execute an SSH command

_method_ `POST`<br>
_path_ `/shellExec`<br>
_body_ 
```
    {
        'command': 'The command to be executed',
        'runInBackground': 'If set to true, the command will be executed in background. Default: false'
    }
```
_output_ `APIOutput | APIError`

**Example**
```
const unraidApp = await Homey.apps.getApp({ id:"it.arturoiafrate.h-unraid-integration" });
const output = await unraidApp.post({path: '/shellExec', body: {
  command: 'ping -c 1 google.it && ping -c 2 aruba.it'
}});
```


##### Share List
This API return available shares

_method_ `GET`<br>
_path_ `/shares`<br>
_output_ `Share[] | APIError`

**Example**
```
const unraidApp = await Homey.apps.getApp({ id:"it.arturoiafrate.h-unraid-integration" });
const output = await unraidApp.get({ path: '/shares'});
```


##### File Action
This API allows to execute file actions

_method_ `POST`<br>
_path_ `/fileAction`<br>
_body_ 
```
    {
        'action': `The action to be done. Allowed values: [CREATE, DELETE, TRUNCATE, READ, WRITE]`,
        'share_name': 'The share name',
        'file_name': 'The file name',
        'content': 'The content of the file. Optional for CREATE action. If not set, the file will be empty',
        'mode': 'The write mode. Mandatory for WRITE action. Allowed values: [append, overwrite]'
    }
```
_output_ `APIOutput | APIError`

**Example**
```
const unraidApp = await Homey.apps.getApp({ id:"it.arturoiafrate.h-unraid-integration" });
const output = await unraidApp.post({path: '/fileAction', body: {
  action: 'READ',
  share_name: 'UnraidShare',
  file_name: 'HomeyLogs/20240328000000.log'
}});
```


##### Folder Action
This API allows to execute folder actions

_method_ `POST`<br>
_path_ `/folderAction`<br>
_body_ 
```
    {
        'action': `The action to be done. Allowed values: [CREATE, DELETE, READ]`,
        'share_name': 'The share name',
        'folder_name': 'The folder name'
    }
```
_output_ `APIOutput | APIError`

**Example**
```
const unraidApp = await Homey.apps.getApp({ id:"it.arturoiafrate.h-unraid-integration" });
const output = await unraidApp.post({path: '/folderAction', body: {
  action: 'READ',
  share_name: 'UnraidShare',
  folder_name: 'Software'
}});
```

##### Container List
This API return informations about docker containers

_method_ `GET`<br>
_path_ `/dockerManagement/containerList`<br>
_query_
```
    {
        'online': 'If specifed, allow to filter the container output list by online status.'
    }
```
_output_ `Container[] | APIError`

**Example**
```
const unraidApp = await Homey.apps.getApp({ id:"it.arturoiafrate.h-unraid-integration" });
const output = await unraidApp.get({ path: '/dockerManagement/containerList?online=false'});
```


##### Container Action
This API allows to execute actions to/inside a container

_method_ `POST` <br>
_path_ `/dockerManagement/action` <br>
_body_ 
```
    {
        'container_id': 'The container ID. One between container_id and container_name must be set',
        'container_name': 'The container name. One between container_id and container_name must be set',
        'action': 'The action to be done. Allowed values: [TURN_ON, TURN_OFF, EXEC]',
        'runInBackground': 'If set to true, the operation will be executed in background. Default: false',
        'params': 'Needed for EXEC action. An object containing {'flags' : string[], 'command': string} flags -> an array of strings, each element is a flag. command -> the command to be executed'
      }
```
_output_ `APIOutput | APIError`

**Example**
```
const unraidApp = await Homey.apps.getApp({ id:"it.arturoiafrate.h-unraid-integration" });
const output = await unraidApp.post({path: '/dockerManagement/action', body: {
  container_name: 'ZEROTIER',
  action: 'TURN_OFF',
  runInBackground: true
}});
const outputExec = await unraidApp.post({path: '/dockerManagement/action', body: {
  container_name: 'ZEROTIER',
  action: 'EXEC',
  params: {command: 'ping -c 1 google.it && ping -c 2 aruba.it'}
}});
```


##### UserScript List
This API return the UserScript List

_method_ `GET`<br>
_path_ `/userScript/scriptList`<br>
_output_ `UserScript[] | APIError`

**Example**
```
const unraidApp = await Homey.apps.getApp({ id:"it.arturoiafrate.h-unraid-integration" });
const output = await unraidApp.get({ path: '/userScript/scriptList'});
```


##### UserScript Action
This API allows to execute/get actions on user scripts

_method_ `POST` <br>
_path_ `/userScript/action` <br>
_body_ 
```
    {
        'user_script_name' : 'The user script name',
        'runInBackground': 'If set to true, the operation will be executed in background. Default: false',
        'action': 'The action to be done. Allowed values: [START, STOP, IS_RUNNING]'
    }
```
_output_ `APIOutput | APIError`

**Example**
```
const unraidApp = await Homey.apps.getApp({ id:"it.arturoiafrate.h-unraid-integration" });
const output = await unraidApp.post({path: '/userScript/action', body: {
  user_script_name: 'homey_notify',
  action: 'START',
  runInBackground: true
}});
```

##### Virtual Machine List
This API return the Virtual Machine List

_method_ `GET`<br>
_path_ `/vm/vmList`<br>
_output_ `VirtualMachine[] | APIError`

**Example**
```
const unraidApp = await Homey.apps.getApp({ id:"it.arturoiafrate.h-unraid-integration" });
const output = await unraidApp.get({ path: '/userScript/scriptList'});
```


##### Virtual Machine Action
This API allows to execute actions on VMs

_method_ `POST` <br>
_path_ `/vm/action` <br>
_body_ 
```
    {
        'virtual_machine_name' : 'The virtual machine name',
        'runInBackground': 'If set to true, the operation will be executed in background. Default: false',
        'action': 'The action to be done. Allowed values: [START, RESUME, STOP, PAUSE, REBOOT]'
    }
```
_output_ `APIOutput | APIError`

**Example**
```
const unraidApp = await Homey.apps.getApp({ id:"it.arturoiafrate.h-unraid-integration" });
const output = await unraidApp.post({path: '/vm/action', body: {
  virtual_machine_name: 'Home Assistant',
  action: 'REBOOT',
  runInBackground: true
}});
```

### Roadmap
- [x] Manage user scripts.
- [x] Monitor and manage docker containers.
- [x] Monitor and manage VMs.
- [x] Create and manage files in shared folders.
- [x] Expose APIs to manage everithing

### Disclaimer
This is an unofficial integration provided for free, all features in this app is provided "as is", with no guarantee of completeness, accuracy, timeliness or of the results obtained from the use of this feature.
The copyrighted materials on this app may be used for informational purposes only. The [unraid](https://unraid.net/) logo and trademark are owned by Lime Technology, Inc.

### Attributions
- [RidenUI Unraid API Client](https://unraid.ridenui.org/)
- [Wake On Lan](https://github.com/song940/wake-on-lan)
- [Ping](https://github.com/justintaddei/tcp-ping)
- [CPU Usage Capability Icon](https://www.svgrepo.com/svg/454733/chip-computer-cpu)
- [Array Usage Capability Icon](https://www.svgrepo.com/svg/454742/computer-device-digital-6)
- [RAM Usage Capability Icon](https://www.svgrepo.com/svg/454734/computer-device-digital-3)
- [Uptime Capability Icon](https://www.svgrepo.com/svg/415299/timer-clock-alarm-time-watch)

### Contributions
- [hot22shot](https://community.homey.app/u/hot22shot) for French translation

### Download
- [Public version](https://homey.app/a/it.arturoiafrate.h-unraid-integration/)
- [Test version](https://homey.app/a/it.arturoiafrate.h-unraid-integration/test/)