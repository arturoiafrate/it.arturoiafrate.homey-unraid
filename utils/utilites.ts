import UnraidRemoteApp from "../app";
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
