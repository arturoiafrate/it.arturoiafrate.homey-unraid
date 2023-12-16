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

### Roadmap
- [x] Manage user scripts.
- [x] Monitor and manage docker containers.
- [x] Monitor and manage VMs.
- [x] Create and manage files in shared folders.

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