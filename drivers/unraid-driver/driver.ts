import Homey from 'homey';

class UnraidDriver extends Homey.Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {}

  /**
   * onPairListDevices is called when a user is adding a device and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices() {//ATM only one device is supported
    return [
      {
        name: 'Unraid',
        data: {
          id: 'unraid-remote-0',
        },
      },
    ];
  }

}

module.exports = UnraidDriver;
