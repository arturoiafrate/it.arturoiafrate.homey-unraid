export const objStringify = (title : string, obj : any) : string => {
    let str = "\n****" + title + "****\n";
    str += JSON.stringify(obj);
    str += "\n************\n";
    return str;
};