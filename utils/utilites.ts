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