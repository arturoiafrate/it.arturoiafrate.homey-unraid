import Homey, { FlowCardTriggerDevice } from 'homey';
import { Container, DockerMonitor } from '../utils/IDockerContainer';
import { UnraidRemoteApp } from '../../../../app';

interface DeviceTriggerCards {
    cpuUsageTriggerCard: FlowCardTriggerDevice,
    arrayUsageTriggerCard: FlowCardTriggerDevice
    cacheUsageTriggerCard: FlowCardTriggerDevice
    ramUsageTriggerCard: FlowCardTriggerDevice
    dockerContainerStatusChangedTriggerCard : FlowCardTriggerDevice
}

class UnraidRemoteFlowTrigger {
    private _cpuUsageIsChangedTriggerCard : FlowCardTriggerDevice;
    private _arrayUsageIsChangedTriggerCard : FlowCardTriggerDevice;
    private _cacheUsageIsChangedTriggerCard : FlowCardTriggerDevice;
    private _ramUsageIsChangedTriggerCard : FlowCardTriggerDevice;
    private _dockerContainerStatusChangedTriggerCard : FlowCardTriggerDevice;
    private _dockerMonitor : DockerMonitor;

    constructor(triggers : DeviceTriggerCards){
        this._cpuUsageIsChangedTriggerCard = triggers.cpuUsageTriggerCard;
        this._arrayUsageIsChangedTriggerCard = triggers.arrayUsageTriggerCard;
        this._cacheUsageIsChangedTriggerCard = triggers.cacheUsageTriggerCard;
        this._ramUsageIsChangedTriggerCard = triggers.ramUsageTriggerCard;
        this._dockerContainerStatusChangedTriggerCard = triggers.dockerContainerStatusChangedTriggerCard;
        this._dockerMonitor = new DockerMonitor();
    }

    triggerCpuUsageFlowCard(device: Homey.Device,cpuUsage: number){
        this._cpuUsageIsChangedTriggerCard?.trigger(device, { 'usage-percent': cpuUsage }, undefined);
    }

    triggerArrayUsageFlowCard(device: Homey.Device,arrayUsage: number){
        this._arrayUsageIsChangedTriggerCard?.trigger(device, { 'usage-percent': arrayUsage }, undefined);
    }

    triggerCacheUsageFlowCard(device: Homey.Device,cacheUsage: number){
        this._cacheUsageIsChangedTriggerCard?.trigger(device, { 'usage-percent': cacheUsage }, undefined);
    }

    triggerRamUsageFlowCard(device: Homey.Device,ramUsage: number){
        this._ramUsageIsChangedTriggerCard?.trigger(device, { 'usage-percent': ramUsage }, undefined);
    }
    
    async triggerDockerContainerStatusChangedFlowCard(device: Homey.Device, containers: Container[], appInstance? : UnraidRemoteApp){
        let args: any[] = await this._dockerContainerStatusChangedTriggerCard.getArgumentValues(device);
        for(const arg of args){
            let container = arg.container as Container;
            if(this._dockerMonitor.isStatusChangedByName(container.name, containers, appInstance)){
                const containerUpdate = containers.find((cont) => cont.name.toUpperCase() === container.name.toUpperCase());
                const isOnline : boolean = this._dockerMonitor.isOnlineByName(container.name);
                const tokens = {
                    'online-status':  isOnline,
                    'status': containerUpdate?.status
                };
                this._dockerContainerStatusChangedTriggerCard?.trigger(device, tokens, undefined);
            }
        }
        
    }
};

export { DeviceTriggerCards, UnraidRemoteFlowTrigger };