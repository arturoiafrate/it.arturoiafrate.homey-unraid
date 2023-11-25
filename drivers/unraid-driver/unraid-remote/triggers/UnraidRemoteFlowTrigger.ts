import Homey, { FlowCardTriggerDevice } from 'homey';

interface DeviceTriggerCards {
    cpuUsageTriggerCard: FlowCardTriggerDevice,
    arrayUsageTriggerCard: FlowCardTriggerDevice
}

class UnraidRemoteFlowTrigger {
    _cpuUsageIsChangedTriggerCard : FlowCardTriggerDevice;
    _arrayUsageIsChangedTriggerCard : FlowCardTriggerDevice;

    constructor(triggers : DeviceTriggerCards){
        this._cpuUsageIsChangedTriggerCard = triggers.cpuUsageTriggerCard;
        this._arrayUsageIsChangedTriggerCard = triggers.arrayUsageTriggerCard;
    }

    triggerCpuUsageFlowCard(device: Homey.Device,cpuUsage: number){
        this._cpuUsageIsChangedTriggerCard?.trigger(device, { 'usage-percent': cpuUsage }, undefined);
    }

    triggerArrayUsageFlowCard(device: Homey.Device,arrayUsage: number){
        this._arrayUsageIsChangedTriggerCard?.trigger(device, { 'usage-percent': arrayUsage }, undefined);
    }
};

export { DeviceTriggerCards, UnraidRemoteFlowTrigger };