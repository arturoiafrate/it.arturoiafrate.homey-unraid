import { Unraid } from '@ridenui/unraid';
import { SSHExecutor } from '@ridenui/unraid/dist/executors/SSH';
import ping from 'ping';
import { IPingEventSubscriber } from './utils/IPingEventSubscriber';

class UnraidRemote {
    _url: string;
    _username: string;
    _password: string;
    _port: number;
    _unraid: Unraid;
    _executor: SSHExecutor;

    _isOnline: boolean = false;
    _isOnlineSubscribers: IPingEventSubscriber[] = [];

    constructor(url: string, username: string, password: string, port: number) {
        this._url = url;
        this._username = username;
        this._password = password;
        this._port = port == 0 ? 22 : port;
        this._isOnline = false;

        this._unraid = new Unraid({
            executor: SSHExecutor,
            executorConfig: {
                host: this._url,
                username: this._username,
                password: this._password,
                port: this._port
            },
        });

        this._executor = this._unraid.executor as SSHExecutor;
    }

    subscribeIsUnraidServerOnline(subscriber: IPingEventSubscriber): void {
        this._isOnlineSubscribers.push(subscriber);
    }

    unsubscribeAll(){
        this._isOnlineSubscribers = [];
    }

    async ping(): Promise<boolean> {
        let res = await ping.promise.probe(this._url);
        this._isOnline = (res && res.alive);
        this._isOnlineSubscribers.forEach(subscriber => {
            if(this._isOnline){
                subscriber.isOnlineCallback();
            } else {
                subscriber.isOfflineCallback();
            }
        });
        return this._isOnline;
    }

    turnOn(macAddress: String) {
        const wol = require('wol');
        wol.wake(macAddress, function(err: any, res: any){
            console.log('res:' + res);
            console.log('err:' + err);
        });
    }
    
    turnOff() {
        this._executor.executeSSH({
            command: 'shutdown -h now'
        });
    }

    async hostname(){
        return await this._unraid.system.getHostname();
    }

    disconnect() {
        this._executor.disconnect();
    }
}

export { UnraidRemote }