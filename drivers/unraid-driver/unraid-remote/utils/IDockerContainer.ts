import { LogLevel, logMessageToSentry } from "../../../../utils/utilites";
import { UnraidRemoteApp } from "../../../../app";

interface Container {
    id: string;
    name: string;
    status: string;
}

class DockerMonitor {
    _containers: Map<string, Container> = new Map<string, Container>();

    isStatusChangedByName(cName: string, containers: Container[], appInstance? : UnraidRemoteApp): boolean {
        if(appInstance) logMessageToSentry(appInstance, 'Checking for '+cName+' online status... ', LogLevel.DEBUG);
        const containerName = cName.toUpperCase();
        let container = containers.find((container) => (container.name.toUpperCase() === containerName));
        if (container === undefined) { //container is removed
            if(appInstance) logMessageToSentry(appInstance, 'Container not found in containers list', LogLevel.DEBUG);
            if(this._containers.has(containerName)){
                if(appInstance) logMessageToSentry(appInstance, 'Container previously found, deleting', LogLevel.DEBUG);
                this._containers.delete(containerName);
                return true;
            }
            return false;//container is not in the list
        }
        if(appInstance) logMessageToSentry(appInstance, 'Container found in the container list', LogLevel.DEBUG);
        if (this._containers.has(containerName)) {//container is in the list
            if(appInstance) logMessageToSentry(appInstance, 'Container has a previous state', LogLevel.DEBUG);
            let oldContainer = this._containers.get(containerName);
            let oldContainerStatusOnline : boolean = oldContainer!.status.toLowerCase().includes("up");
            let newContainerStatusOnline : boolean = container.status.toLowerCase().includes("up");
            if(appInstance) logMessageToSentry(appInstance, 'Old status: '+ oldContainerStatusOnline+', New status: '+newContainerStatusOnline, LogLevel.DEBUG);
            if(oldContainerStatusOnline !== newContainerStatusOnline){
                this._containers.set(containerName, container);
                return true;//container is in the list and status is changed
            }
            return false;//container is in the list and status is not changed
        }
        this._containers.set(containerName, container);//adding/updating container to the list
        return false;
    }

    /**
     * 
     * @deprecated use isStatusChangedByName instead
     */
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

    isOnlineByName(containerName: string): boolean {
        let container = this._containers.get(containerName.toUpperCase());
        if (container === undefined) {
            return false;
        }
        return container.status.toLowerCase().includes("up");
    }

    /**
     * 
     * @deprecated use isOnlineByName instead
     */
    isOnline(containerId: string): boolean {
        let container = this._containers.get(containerId);
        if (container === undefined) {
            return false;
        }
        return container.status.toLowerCase().includes("up");
    }
}

export { Container, DockerMonitor };