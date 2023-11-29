
interface Container {
    id: string;
    name: string;
    status: string;
}

class DockerMonitor {
    _containers: Map<string, Container> = new Map<string, Container>();

    isStatusChanged(containerId: string, containers: Container[]): boolean {
        let container = containers.find((container) => container.id === containerId);
        if (container === undefined) {//container is removed
            if(this._containers.has(containerId)){
                this._containers.delete(containerId);
                return true;
            }
            return false;//container is not in the list
        }
        if (this._containers.has(containerId)) {//container is in the list
            let oldContainer = this._containers.get(containerId);
            let oldContainerStatusOnline : boolean = oldContainer!.status.toLowerCase().includes("up");
            let newContainerStatusOnline : boolean = container.status.toLowerCase().includes("up");
            if(oldContainerStatusOnline !== newContainerStatusOnline){
                this._containers.set(containerId, container);
                return true;//container is in the list and status is changed
            }
            return false;//container is in the list and status is not changed
        }
        this._containers.set(containerId, container);//container is not in the list
        return false;
    }

    isOnline(containerId: string): boolean {
        let container = this._containers.get(containerId);
        if (container === undefined) {
            return false;
        }
        return container.status.toLowerCase().includes("up");
    }
}

export { Container, DockerMonitor };