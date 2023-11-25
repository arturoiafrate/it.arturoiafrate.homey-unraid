import Homey, { FlowCardTriggerDevice } from 'homey';

interface DeviceTriggerCards {
    cpuUsageTriggerCard: FlowCardTriggerDevice,
    arrayUsageTriggerCard: FlowCardTriggerDevice
    cacheUsageTriggerCard: FlowCardTriggerDevice
    ramUsageTriggerCard: FlowCardTriggerDevice
}

class UnraidRemoteFlowTrigger {
    _cpuUsageIsChangedTriggerCard : FlowCardTriggerDevice;
    _arrayUsageIsChangedTriggerCard : FlowCardTriggerDevice;
    _cacheUsageIsChangedTriggerCard : FlowCardTriggerDevice;
    _ramUsageIsChangedTriggerCard : FlowCardTriggerDevice;

    constructor(triggers : DeviceTriggerCards){
        this._cpuUsageIsChangedTriggerCard = triggers.cpuUsageTriggerCard;
        this._arrayUsageIsChangedTriggerCard = triggers.arrayUsageTriggerCard;
        this._cacheUsageIsChangedTriggerCard = triggers.cacheUsageTriggerCard;
        this._ramUsageIsChangedTriggerCard = triggers.ramUsageTriggerCard;
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
};

export { DeviceTriggerCards, UnraidRemoteFlowTrigger };