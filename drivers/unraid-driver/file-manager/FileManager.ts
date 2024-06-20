
import { SSHExecutor } from '@ridenui/unraid/dist/executors/SSH';

interface Share {
  name: string;
  path: string;
  description: string;
}

interface File {
  isFolder: boolean;
  name: string;
  owner: string;
  permissions: string;
  size: number;
}

enum WriteMode {
  APPEND = '>>',
  OVERWRITE = '>'
}

interface WriteModeElement {
  name: string;
  value: WriteMode;
}

class FileManager {

  private _sshExecutor: SSHExecutor;

  constructor(sshExecutor: SSHExecutor) {
    this._sshExecutor = sshExecutor;
  }

  public async getShares(): Promise<Share[]>{
    const command: string = 'ls /mnt/user';
    let shares: Share[] = [];
    try{
      const { code, stdout, stderr } = await this._sshExecutor.execute(command);
      if(code === 0 && stdout && stdout.length > 0){
        stdout.map((shareName: string) => {
          shares.push({
            name: shareName,
            path: '/mnt/user/'+shareName,
            description: shareName
          });
        });
      }
    } catch (error) {}
    return shares;
  }

  public async fileExists(pathToFile: string, userShare: string): Promise<boolean>{
    let completeFilePath: string = userShare+'/'+this._formatPath(pathToFile);
    const command: string = 'if [ -f '+completeFilePath+' ]; then echo "true"; else echo "false"; fi';
    try{
      const { code, stdout, stderr } = await this._sshExecutor.execute(command);
      return code === 0 && stdout && stdout[0]  === 'true';
    } catch (error) {
      return false;
    }
  }

  public async folderExists(pathToFolder: string, userShare: string): Promise<boolean>{
    let completeFolderPath: string = userShare+'/'+this._formatPath(pathToFolder);
    const command: string = 'if [ -d '+completeFolderPath+' ]; then echo "true"; else echo "false"; fi';
    try{
      const { code, stdout, stderr } = await this._sshExecutor.execute(command);
      return code === 0 && stdout && stdout[0]  === 'true';
    } catch (error) {
      return false;
    }
  }

  public async readFile(pathToFile: string, userShare: string): Promise<string>{
    let completeFilePath: string = userShare+'/'+this._formatPath(pathToFile);
    const command: string = 'cat '+completeFilePath;
    try{
      const { code, stdout, stderr } = await this._sshExecutor.execute(command);
      if(code === 0 && stdout && stdout.length > 0){
        return stdout.join('\n');
      }
    } catch (error) {}
    return '';
  }

  public async readDir(pathToDir: string, userShare: string): Promise<File[]>{
    let completeDirPath: string = userShare+'/'+this._formatPath(pathToDir);
    const folderExists = await this.folderExists(pathToDir, userShare);
    if(!folderExists){
      return [];
    }
    const command: string = `cd ${completeDirPath} && stat -c '%F,%n,%U,%a,%s' *`;
    let files: File[] = [];
    try{
      const { code, stdout, stderr } = await this._sshExecutor.execute(command);
      if(code === 0 && stdout && stdout.length > 0){
        stdout.forEach((row: string) => {
          const infos = row.split(',');
          files.push({
            isFolder: infos[0] === 'directory',
            name: infos[1],
            owner: infos[2],
            permissions: infos[3],
            size: parseInt(infos[4])
          });
        });
      }
    } catch (error) {}
    return files;
  }

  public async createFile(pathToFile: string, userShare: string): Promise<boolean>{
    let completeFilePath: string = userShare+'/'+this._formatPath(pathToFile);
    const command: string = 'touch '+completeFilePath;
    try{
      const { code, stdout, stderr } = await this._sshExecutor.execute(command);
      return code === 0;
    } catch (error) {
      return false;
    }
  }

  public async createFileWithContent(pathToFile: string, content: string, userShare: string): Promise<boolean>{
    let completeFilePath: string = userShare+'/'+this._formatPath(pathToFile);
    const command: string = 'echo "'+content+'" > '+completeFilePath;
    try{
      const { code, stdout, stderr } = await this._sshExecutor.execute(command);
      return code === 0;
    } catch (error) {
      return false;
    }
  }

  public async createFolder(pathToFolder: string, userShare: string): Promise<boolean>{
    let completeFolderPath: string = userShare+'/'+this._formatPath(pathToFolder);
    const command: string = 'mkdir '+completeFolderPath;
    try{
      const { code, stdout, stderr } = await this._sshExecutor.execute(command);
      return code === 0;
    } catch (error) {
      return false;
    }
  }

  public async writeFile(pathToFile: string, content: string, userShare: string, mode: WriteMode): Promise<boolean>{
    const fileExists = await this.fileExists(pathToFile, userShare);
    if(!fileExists){
      const fileCreated = await this.createFile(pathToFile, userShare);
      if(!fileCreated){
        return false;
      }
    }
    let completeFilePath: string = userShare+'/'+this._formatPath(pathToFile);
    const command: string = `echo '${content}' ${mode} ${completeFilePath}`;
    try{
      const { code, stdout, stderr } = await this._sshExecutor.execute(command);
      return code === 0;
    } catch (error) {}
    return false;
  }

  public async truncateFile(pathToFile: string, userShare: string): Promise<boolean>{
    let completeFilePath: string = userShare+'/'+this._formatPath(pathToFile);
    const command: string = 'truncate -s 0 '+completeFilePath;
    try{
      const { code, stdout, stderr } = await this._sshExecutor.execute(command);
      return code === 0;
    } catch (error) {}
    return false;
  }

  public async deleteFile(pathToFile: string, userShare: string): Promise<boolean>{
    let completeFilePath: string = userShare+'/'+this._formatPath(pathToFile);
    const command: string = 'rm '+completeFilePath;
    try{
      const { code, stdout, stderr } = await this._sshExecutor.execute(command);
      return code === 0;
    } catch (error) {}
    return false;
  }

  public async deleteFolder(pathToFolder: string, userShare: string): Promise<boolean>{
    let completeFolderPath: string = userShare+'/'+this._formatPath(pathToFolder);
    const command: string = 'rm -rf '+completeFolderPath;
    try{
      const { code, stdout, stderr } = await this._sshExecutor.execute(command);
      return code === 0;
    } catch (error) {}
    return false;
  }

  private _formatPath(path: string): string{
    let formattedPath = '';
    path = path.replace('\\', '/');
    path = path.startsWith('/') ?  path.substring(1) : path;
    path = path.endsWith('/') ? path.substring(0, path.length - 1) : path;
    path.split('/').forEach((pathPart: string) => {
      let formattedPathPart = (pathPart.includes(' ')  && !(pathPart.startsWith("'") || pathPart.startsWith('"'))) ? "'"+pathPart+"'" : pathPart;
      formattedPath += formattedPathPart+'/';
    });
    formattedPath = formattedPath.endsWith('/') ? formattedPath.substring(0, formattedPath.length - 1) : formattedPath;
    return formattedPath;
  }
}

export { Share, File, WriteMode, WriteModeElement, FileManager };
