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

2. Actually you can do:
- Execute a generic SSH command
- Execute a generic SSH command and wait for the output (Advanced Flow)

For each one of them you can trigger a flow. For example:
**_When_ CPU Usage is changed _and_ CPU Usage is over a _threshold_, _execute_ something.**

### Roadmap
- [ ] Manage user scripts.
- [ ] Monitor and manage docker containers.
- [ ] Monitor and manage VMs. 

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