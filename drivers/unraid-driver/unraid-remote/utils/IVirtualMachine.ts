import { VMState } from "@ridenui/unraid/dist/modules/vms/vm";

interface VirtualMachine {
    name: string;
    id?: string;
    state: VMState;
}

interface State {
    name: string;
    description: string;
}

interface Mode {
    name: string;
    description: string;
}

export {VirtualMachine, State, Mode};