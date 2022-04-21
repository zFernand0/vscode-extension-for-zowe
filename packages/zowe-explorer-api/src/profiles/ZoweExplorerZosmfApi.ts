/*
 * This program and the accompanying materials are made available under the terms of the *
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at *
 * https://www.eclipse.org/legal/epl-v20.html                                      *
 *                                                                                 *
 * SPDX-License-Identifier: EPL-2.0                                                *
 *                                                                                 *
 * Copyright Contributors to the Zowe Project.                                     *
 *                                                                                 *
 */

import { Login, Logout } from "@zowe/core-for-zowe-sdk";
import { IConsoleResponse, IssueCommand } from "@zowe/zos-console-for-zowe-sdk";
import {
    Copy,
    Create,
    CreateDataSetTypeEnum,
    Delete,
    Download,
    HMigrate,
    HRecall,
    ICopyDatasetOptions,
    ICreateDataSetOptions,
    IDataSet,
    IDeleteDatasetOptions,
    IDownloadOptions,
    IListOptions,
    IUploadOptions,
    IZosFilesResponse,
    List,
    Rename,
    Upload,
    Utilities,
} from "@zowe/zos-files-for-zowe-sdk";
import {
    IDownloadAllSpoolContentParms,
    DownloadJobs,
    SubmitJobs,
    DeleteJobs,
    IJob,
    GetJobs,
    IJobFile,
    IJobFeedback,
} from "@zowe/zos-jobs-for-zowe-sdk";
import { IIssueResponse, IssueTso, IStartTsoParms } from "@zowe/zos-tso-for-zowe-sdk";
import { ZosmfSession, CheckStatus } from "@zowe/zosmf-for-zowe-sdk";
import { Session, SessConstants, IProfileLoaded, ICommandArguments, ConnectionPropsForSessCfg } from "@zowe/imperative";
import { ZoweExplorerApi } from "./ZoweExplorerApi";

/**
 * An implementation of the Zowe Explorer API Common interface for zOSMF.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
class ZosmfApiCommon implements ZoweExplorerApi.ICommon {
    public static getProfileTypeName(): string {
        return "zosmf";
    }

    private session: Session;
    public constructor(public profile?: IProfileLoaded) {}

    public getProfileTypeName(): string {
        return ZosmfUssApi.getProfileTypeName();
    }

    public getSessionFromCommandArgument(cmdArgs: ICommandArguments): Session {
        const sessCfg = ZosmfSession.createSessCfgFromArgs(cmdArgs);
        ConnectionPropsForSessCfg.resolveSessCfgProps(sessCfg, cmdArgs);
        const sessionToUse = new Session(sessCfg);
        return sessionToUse;
    }

    public getSession(profile?: IProfileLoaded): Session {
        if (!this.session) {
            try {
                if (!this.profile.profile.tokenValue) {
                    const serviceProfile = profile || this.profile;
                    const cmdArgs: ICommandArguments = {
                        $0: "zowe",
                        _: [""],
                        host: serviceProfile.profile.host,
                        port: serviceProfile.profile.port,
                        basePath: serviceProfile.profile.basePath,
                        rejectUnauthorized: serviceProfile.profile.rejectUnauthorized,
                        user: serviceProfile.profile.user,
                        password: serviceProfile.profile.password,
                    };

                    this.session = this.getSessionFromCommandArgument(cmdArgs);
                } else {
                    const serviceProfile = this.profile;
                    const cmdArgs: ICommandArguments = {
                        $0: "zowe",
                        _: [""],
                        host: serviceProfile.profile.host,
                        port: serviceProfile.profile.port,
                        basePath: serviceProfile.profile.basePath,
                        rejectUnauthorized: serviceProfile.profile.rejectUnauthorized,
                        tokenType: serviceProfile.profile.tokenType,
                        tokenValue: serviceProfile.profile.tokenValue,
                    };

                    this.session = this.getSessionFromCommandArgument(cmdArgs);
                }
            } catch (error) {
                // todo: initialize and use logging
            }
        }
        return this.session;
    }

    public async getStatus(validateProfile?: IProfileLoaded, profileType?: string): Promise<string> {
        // This API call is specific for z/OSMF profiles
        let validateSession: Session;
        if (profileType === "zosmf") {
            if (validateProfile.profile.tokenValue) {
                const serviceProfile = validateProfile;
                const cmdArgs: ICommandArguments = {
                    $0: "zowe",
                    _: [""],
                    host: serviceProfile.profile.host,
                    port: serviceProfile.profile.port,
                    basePath: serviceProfile.profile.basePath,
                    rejectUnauthorized: serviceProfile.profile.rejectUnauthorized,
                    tokenType: serviceProfile.profile.tokenType,
                    tokenValue: serviceProfile.profile.tokenValue,
                };

                validateSession = this.getSessionFromCommandArgument(cmdArgs);
            } else {
                const serviceProfile = validateProfile;
                const cmdArgs: ICommandArguments = {
                    $0: "zowe",
                    _: [""],
                    host: serviceProfile.profile.host,
                    port: serviceProfile.profile.port,
                    basePath: serviceProfile.profile.basePath,
                    rejectUnauthorized: serviceProfile.profile.rejectUnauthorized,
                    user: serviceProfile.profile.user,
                    password: serviceProfile.profile.password,
                };

                validateSession = this.getSessionFromCommandArgument(cmdArgs);
            }

            const sessionStatus = await CheckStatus.getZosmfInfo(validateSession);

            if (sessionStatus) {
                return "active";
            } else {
                return "inactive";
            }
        } else {
            return "unverified";
        }
    }

    public getTokenTypeName(): string {
        return SessConstants.TOKEN_TYPE_APIML;
    }

    public login(session: Session): Promise<string> {
        return Login.apimlLogin(session);
    }

    public logout(session: Session): Promise<void> {
        return Logout.apimlLogout(session);
    }
}

/**
 * An implementation of the Zowe Explorer USS API interface for zOSMF.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
export class ZosmfUssApi extends ZosmfApiCommon implements ZoweExplorerApi.IUss {
    public async fileList(ussFilePath: string): Promise<IZosFilesResponse> {
        return await List.fileList(this.getSession(), ussFilePath);
    }

    public async isFileTagBinOrAscii(ussFilePath: string): Promise<boolean> {
        return await Utilities.isFileTagBinOrAscii(this.getSession(), ussFilePath);
    }

    public async getContents(inputFilePath: string, options: IDownloadOptions): Promise<IZosFilesResponse> {
        return await Download.ussFile(this.getSession(), inputFilePath, options);
    }

    /**
     * API method to wrap to the newer `putContent`.
     * @deprecated
     */
    public async putContents(
        inputFilePath: string,
        ussFilePath: string,
        binary?: boolean,
        localEncoding?: string,
        etag?: string,
        returnEtag?: boolean
    ): Promise<IZosFilesResponse> {
        return await this.putContent(inputFilePath, ussFilePath, {
            binary,
            localEncoding,
            etag,
            returnEtag,
        });
    }

    public async putContent(
        inputFilePath: string,
        ussFilePath: string,
        options: IUploadOptions
    ): Promise<IZosFilesResponse> {
        return await Upload.fileToUssFile(this.getSession(), inputFilePath, ussFilePath, options);
    }

    public async uploadDirectory(
        inputDirectoryPath: string,
        ussDirectoryPath: string,
        options?: IUploadOptions
    ): Promise<IZosFilesResponse> {
        return await Upload.dirToUSSDirRecursive(this.getSession(), inputDirectoryPath, ussDirectoryPath, options);
    }

    public async create(ussPath: string, type: string, mode?: string): Promise<IZosFilesResponse> {
        return await Create.uss(this.getSession(), ussPath, type, mode);
    }

    public async delete(ussPath: string, recursive?: boolean): Promise<IZosFilesResponse> {
        // handle zosmf api issue with file paths
        const fixedName = ussPath.startsWith("/") ? ussPath.substring(1) : ussPath;
        return await Delete.ussFile(this.getSession(), fixedName, recursive);
    }

    public async rename(currentUssPath: string, newUssPath: string): Promise<IZosFilesResponse> {
        const result = await Utilities.renameUSSFile(this.getSession(), currentUssPath, newUssPath);
        return {
            success: true,
            commandResponse: null,
            apiResponse: result,
        };
    }
}

/**
 * An implementation of the Zowe Explorer MVS API interface for zOSMF.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
export class ZosmfMvsApi extends ZosmfApiCommon implements ZoweExplorerApi.IMvs {
    public async dataSet(filter: string, options?: IListOptions): Promise<IZosFilesResponse> {
        return await List.dataSet(this.getSession(), filter, options);
    }

    public async allMembers(dataSetName: string, options?: IListOptions): Promise<IZosFilesResponse> {
        return await List.allMembers(this.getSession(), dataSetName, options);
    }

    public async getContents(dataSetName: string, options?: IDownloadOptions): Promise<IZosFilesResponse> {
        return await Download.dataSet(this.getSession(), dataSetName, options);
    }

    public async putContents(
        inputFilePath: string,
        dataSetName: string,
        options?: IUploadOptions
    ): Promise<IZosFilesResponse> {
        return await Upload.pathToDataSet(this.getSession(), inputFilePath, dataSetName, options);
    }

    public async createDataSet(
        dataSetType: CreateDataSetTypeEnum,
        dataSetName: string,
        options?: Partial<ICreateDataSetOptions>
    ): Promise<IZosFilesResponse> {
        return await Create.dataSet(this.getSession(), dataSetType, dataSetName, options);
    }

    public async createDataSetMember(dataSetName: string, options?: IUploadOptions): Promise<IZosFilesResponse> {
        return await Upload.bufferToDataSet(this.getSession(), Buffer.from(""), dataSetName, options);
    }

    public async allocateLikeDataSet(dataSetName: string, likeDataSetName: string): Promise<IZosFilesResponse> {
        return await Create.dataSetLike(this.getSession(), dataSetName, likeDataSetName);
    }

    public async copyDataSetMember(
        { dsn: fromDataSetName, member: fromMemberName }: IDataSet,
        { dsn: toDataSetName, member: toMemberName }: IDataSet,
        options?: ICopyDatasetOptions
    ): Promise<IZosFilesResponse> {
        let newOptions: ICopyDatasetOptions;
        if (options) {
            if (options["from-dataset"]) {
                newOptions = options;
            } else {
                newOptions = {
                    ...options,
                    ...{ "from-dataset": { dsn: fromDataSetName, member: fromMemberName } },
                };
            }
        } else {
            // If we decide to match 1:1 the Copy.dataSet implementation, we will need to break the interface definition in the ZoweExploreApi
            newOptions = { "from-dataset": { dsn: fromDataSetName, member: fromMemberName } };
        }
        return await Copy.dataSet(this.getSession(), { dsn: toDataSetName, member: toMemberName }, newOptions);
    }

    public async renameDataSet(currentDataSetName: string, newDataSetName: string): Promise<IZosFilesResponse> {
        return await Rename.dataSet(this.getSession(), currentDataSetName, newDataSetName);
    }

    public async renameDataSetMember(
        dataSetName: string,
        oldMemberName: string,
        newMemberName: string
    ): Promise<IZosFilesResponse> {
        return await Rename.dataSetMember(this.getSession(), dataSetName, oldMemberName, newMemberName);
    }

    public async hMigrateDataSet(dataSetName: string): Promise<IZosFilesResponse> {
        return await HMigrate.dataSet(this.getSession(), dataSetName);
    }

    public async hRecallDataSet(dataSetName: string): Promise<IZosFilesResponse> {
        return await HRecall.dataSet(this.getSession(), dataSetName);
    }

    public async deleteDataSet(dataSetName: string, options?: IDeleteDatasetOptions): Promise<IZosFilesResponse> {
        return await Delete.dataSet(this.getSession(), dataSetName, options);
    }
}

/**
 * An implementation of the Zowe Explorer JES API interface for zOSMF.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
export class ZosmfJesApi extends ZosmfApiCommon implements ZoweExplorerApi.IJes {
    public async getJobsByOwnerAndPrefix(owner: string, prefix: string): Promise<IJob[]> {
        return await GetJobs.getJobsByOwnerAndPrefix(this.getSession(), owner, prefix);
    }

    public async getJob(jobid: string): Promise<IJob> {
        return await GetJobs.getJob(this.getSession(), jobid);
    }

    public async getSpoolFiles(jobname: string, jobid: string): Promise<IJobFile[]> {
        return await GetJobs.getSpoolFiles(this.getSession(), jobname, jobid);
    }

    public async downloadSpoolContent(parms: IDownloadAllSpoolContentParms): Promise<void> {
        return await DownloadJobs.downloadAllSpoolContentCommon(this.getSession(), parms);
    }

    public async getSpoolContentById(jobname: string, jobid: string, spoolId: number): Promise<string> {
        return await GetJobs.getSpoolContentById(this.getSession(), jobname, jobid, spoolId);
    }

    public async getJclForJob(job: IJob): Promise<string> {
        return await GetJobs.getJclForJob(this.getSession(), job);
    }

    public async submitJcl(jcl: string, internalReaderRecfm?: string, internalReaderLrecl?: string): Promise<IJob> {
        return await SubmitJobs.submitJcl(this.getSession(), jcl, internalReaderRecfm, internalReaderLrecl);
    }

    public async submitJob(jobDataSet: string): Promise<IJob> {
        return await SubmitJobs.submitJob(this.getSession(), jobDataSet);
    }

    public async deleteJob(jobname: string, jobid: string): Promise<void> {
        await DeleteJobs.deleteJob(this.getSession(), jobname, jobid);
    }

    public async deleteJobWithInfo(jobname: string, jobid: string): Promise<undefined | IJobFeedback> {
        return await DeleteJobs.deleteJob(this.getSession(), jobname, jobid);
    }
}

/**
 * An implementation of the Zowe Explorer Command API interface for zOSMF.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
export class ZosmfCommandApi extends ZosmfApiCommon implements ZoweExplorerApi.ICommand {
    public async issueTsoCommand(command: string, acctNum: string): Promise<IIssueResponse> {
        return await IssueTso.issueTsoCommand(this.getSession(), acctNum, command);
    }

    public async issueTsoCommandWithParms(command: string, parms: IStartTsoParms): Promise<IIssueResponse> {
        return await IssueTso.issueTsoCommand(this.getSession(), parms.account, command, parms);
    }

    public async issueMvsCommand(command: string): Promise<IConsoleResponse> {
        return await IssueCommand.issueSimple(this.getSession(), command);
    }
}
