Unofficial integration for Unraid.
This integration allows you to monitor and manage your Unraid NAS server.

Supported languages:
English
Italiano
Français

How does it work?
Install the app and add a new unraid device. Open the device settings and configure:
• Host > the hostname/ip address of your Unraid NAS
• Username > a valid user on your Unraid Server. You can also use the root user.
• Password > the user password
• Port > the port for SSH connection. Default: 22
• Ping interval > the ping interval (in seconds). Used to check if the Unraid server is online. Default: 3
• MAC address > the mac address of your Unraid Server. If is set and your unraid server is on your LAN, you can send a magic packet (WOL) to wake up the NAS.
• Check interval > the refresh interval (in seconds) of all sensors.

For more information about the service setup visit the github repository.