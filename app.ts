import Homey from 'homey';
//require("inspector").open(9229, "0.0.0.0", false);

class MyApp extends Homey.App {

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('MyApp has been initialized');
  }

}

module.exports = MyApp;
