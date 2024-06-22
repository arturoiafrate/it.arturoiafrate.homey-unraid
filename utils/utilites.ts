import path from "path";
import { UnraidRemoteApp }  from "../app";
import Homey from 'homey';

export enum LogLevel {
    DEBUG = 0,
    TRACE = 1,
    INFO = 2,
    WARN = 3,
    ERROR = 4,
    CRITICAL = 5,
    FATAL = 6,
    DISABLED = 9
};

export const objStringify = (title : string, obj : any) : string => {
    let str = "\n****" + title + "****\n";
    str += JSON.stringify(obj);
    str += "\n************\n";
    return str;
};

export const isNonEmpty = (str : string) : boolean => {
    return typeof str === 'string' && str.length > 0;
};

export const convertToUnraidUptime = (years: number=0, days: number=0, hours: number=0, minutes: number=0) : number => {
    return (years * 365 * 24) + (days * 24) + hours +(minutes/100);
};

export const logMessageToSentry = (appInstance: UnraidRemoteApp, message: string, level: LogLevel = LogLevel.ERROR) : void => {
    const currentLogLevel: number = Number(Homey.env.LOG_LEVEL || LogLevel.DISABLED);
    if(appInstance.homeyLog && level >= currentLogLevel){
        appInstance.homeyLog.captureMessage(LogLevel[level]+ ': '+message);
    }
}

export const logErrorToSentry = (appInstance: UnraidRemoteApp, err: Error) : void => {
    const currentLogLevel: number = Number(Homey.env.LOG_LEVEL || LogLevel.DISABLED);
    if(appInstance.homeyLog && currentLogLevel != LogLevel.DISABLED){
        appInstance.homeyLog.captureError(err);
    }
}

export interface APIDefinition {
    method: string;
    path: string;
    query?: Record<string, string>,
    body?: Record<string, string>;
    description: string;
    output: string;
}

export interface APIError {
    error: string,
    code?: Number
}

export enum ContainerActionEnum  {
    TURN_ON = 'TURN_ON',
    TURN_OFF = 'TURN_OFF',
    EXEC = 'EXEC'
}

export enum UserScriptActionEnum  {
    START = 'START',
    STOP = 'STOP',
    IS_RUNNING = 'IS_RUNNING'
}

export enum VMActionEnum {
    START = 'START',
    RESUME = 'RESUME',
    STOP = 'STOP',
    PAUSE = 'PAUSE',
    REBOOT = 'REBOOT'
}

export enum FileActionEnum {
    CREATE = 'CREATE',
    DELETE = 'DELETE',
    TRUNCATE = 'TRUNCATE',
    READ = 'READ',
    WRITE = 'WRITE',
    LIST = 'LIST'
}

export enum FolderActionEnum {
    CREATE = 'CREATE',
    DELETE = 'DELETE',
    READ = 'READ'
}

export interface APIAction {
    container_id?: string,
    container_name?: string,
    user_script_name?: string,
    virtual_machine_name?: string,
    file_name?: string,
    folder_name?: string,
    share_name?: string,
    action?: ContainerActionEnum | UserScriptActionEnum | VMActionEnum | FileActionEnum | FolderActionEnum,
    command?: string,
    runInBackground?: boolean
    params?: any
}

export interface APIOutput{
    operationDone: boolean,
    message?: string
    params?: any[]
}

export const APIDefinition_Description = {
    method: "string",
    path: "string",
    query: "optional<Record<string, string>>",
    body: "optional<Record<string, string>>",
    description: "string",
    output: "string"
}

export const Share_Description = {
    name: "string",
    path: "string",
    description: "string"
}

export const Container_Description = {
    id: "string",
    name: "string",
    status: "string"
}

export const ISystemStats_Description = {
    cpuUsage: "optional<{percentIdle, percentBusy, {coreCount, cores, raw}}>",
    uptime: "optional<{upSince, {raw, upSince}}>",
    arrayUsage: "optional<{raw, total, used, free, percentUsed}>",
    cacheUsage: "optional<{raw, total, used, free, percentUsed}>",
    ramUsage: "optional<{raw, total, used, free, percentUsed}>",
    memoryUsage: "optional<{raw, lastPid, loadAverage}>",
    diskUsage: "optional<[{fs, blocks, used, available, mounted}]>"
}

export const UserScript_Description = {
    name: "string",
    foregroundOnly: "boolean",
    backgroundOnly: "boolean"
}

export const VirtualMachine_Description = {
    name: "string",
    id: "optional<string>",
    state: "string"
}

export const APIError_Description = {
    error: "string",
    code: "optional<Number>" 
}

export const APIOutput_Descrption = {
    operationDone: "boolean",
    message: "optional<string>",
    params: "optional<any>"
}