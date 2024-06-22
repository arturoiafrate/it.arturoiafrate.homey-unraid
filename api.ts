import { UnraidRemoteApp } from './app';
import { APIAction, ContainerActionEnum, FileActionEnum, FolderActionEnum, UserScriptActionEnum, VMActionEnum } from './utils/utilites';

interface AppInstance {
    app: UnraidRemoteApp;
}

interface Parameters {
    homey: AppInstance;
    query?: Record<string, any>;
    params?: Record<string, any>;
    body?: Record<string, any>;
}

export async function getOperationList({ homey }: Parameters): Promise<string> {
    const result = await homey.app.getAvailableApiList();
    return JSON.stringify(result);
}

export async function getDatatypeInfo({ homey, params }: Parameters): Promise<string> {
    if(!params || params == null || !params!.datatype) return JSON.stringify({ error: "Required parameter: datatype", code: -1 });
    const result = await homey.app.getDatatypeInfo(params!.datatype);
    return JSON.stringify(result);
}

export async function getSystemInfo({ homey }: Parameters): Promise<string> {
    const result = await homey.app.getSystemInfo();
    return JSON.stringify(result);
}

export async function doShellExec({ homey, body }: Parameters): Promise<string>{
    if(!body || body == null) return JSON.stringify({ error: "Empty body", code: -1 });
    const apiAction = body as APIAction;
    if(!apiAction.command || typeof apiAction.command === 'undefined' || apiAction.command.trim().length == 0) return JSON.stringify({ error: "command must be not null", code: -2 });
    const result = await homey.app.doExecShell(apiAction);
    return JSON.stringify(result);
}

export async function getShares({ homey }: Parameters): Promise<string> {
    const result = await homey.app.getShares();
    return JSON.stringify(result);
}

export async function doFileAction({ homey, body }: Parameters): Promise<string>{
    if(!body || body == null) return JSON.stringify({ error: "Empty body", code: -1 });
    const fileAction = body as APIAction;
    if(!fileAction.file_name) return JSON.stringify({ error: "file_name can not be empty", code: -2 });
    if(!fileAction.action) return JSON.stringify({ error: "action must be not null", code: -3 });
    if(!Object.values(FileActionEnum).includes(fileAction.action as FileActionEnum)) return JSON.stringify({ error: "The specified action is not defined", code: -4 });
    if(!fileAction.share_name) return JSON.stringify({ error: "share_name can not be empty", code: -5 });
    const result = await homey.app.doFileAction(fileAction);
    return JSON.stringify(result);
}

export async function doFolderAction({ homey, body }: Parameters): Promise<string>{
    if(!body || body == null) return JSON.stringify({ error: "Empty body", code: -1 });
    const folderAction = body as APIAction;
    if(!folderAction.folder_name) return JSON.stringify({ error: "folder_name can not be empty", code: -2 });
    if(!folderAction.action) return JSON.stringify({ error: "action must be not null", code: -3 });
    if(!Object.values(FolderActionEnum).includes(folderAction.action as FolderActionEnum)) return JSON.stringify({ error: "The specified action is not defined", code: -4 });
    if(!folderAction.share_name) return JSON.stringify({ error: "share_name can not be empty", code: -5 });
    const result = await homey.app.doFolderAction(folderAction);
    return JSON.stringify(result);
}

export async function getContainerList({ homey, query }: Parameters): Promise<string>{
    const result = await homey.app.getContainerList((typeof query?.online == 'undefined') ? undefined : (query!.online == 'true'));
    return JSON.stringify(result);
}

export async function doContainerAction({ homey, body }: Parameters): Promise<string>{
    if(!body || body == null) return JSON.stringify({ error: "Empty body", code: -1 });
    const containerAction = body as APIAction;
    if(!containerAction.container_id && !containerAction.container_name) return JSON.stringify({ error: "container_id and container_name can not be both empty", code: -2 });
    if(!containerAction.action) return JSON.stringify({ error: "action must be not null", code: -3 });
    if(!Object.values(ContainerActionEnum).includes(containerAction.action as ContainerActionEnum)) return JSON.stringify({ error: "The specified action is not defined", code: -4 });
    const result = await homey.app.doContainerAction(containerAction);
    return JSON.stringify(result);
}

export async function getUserScriptList({ homey }: Parameters): Promise<string> {
    const result = await homey.app.getUserScriptList()
    return JSON.stringify(result);
}

export async function doUserScriptAction({ homey, body }: Parameters): Promise<string>{
    if(!body || body == null) return JSON.stringify({ error: "Empty body", code: -1 });
    const scriptAction = body as APIAction;
    if(!scriptAction.user_script_name) return JSON.stringify({ error: "user_script_name can not be empty", code: -2 });
    if(!scriptAction.action) return JSON.stringify({ error: "action must be not null", code: -3 });
    if(!Object.values(UserScriptActionEnum).includes(scriptAction.action as UserScriptActionEnum)) return JSON.stringify({ error: "The specified action is not defined", code: -4 });
    const result = await homey.app.doUserScriptAction(scriptAction);
    return JSON.stringify({operationDone: result});
}

export async function getVMList({ homey }: Parameters): Promise<string> {
    const result = await homey.app.getVMList();
    return JSON.stringify(result);
}    

export async function doVMAction({ homey, body }: Parameters): Promise<string>{
    if(!body || body == null) return JSON.stringify({ error: "Empty body", code: -1 });
    const vmAction = body as APIAction;
    if(!vmAction.virtual_machine_name) return JSON.stringify({ error: "virtual_machine_name can not be empty", code: -2 });
    if(!vmAction.action) return JSON.stringify({ error: "action must be not null", code: -3 });
    if(!Object.values(VMActionEnum).includes(vmAction.action as VMActionEnum)) return JSON.stringify({ error: "The specified action is not defined", code: -4 });
    const result = await homey.app.doVMAction(vmAction);
    return JSON.stringify({operationDone: result});
}