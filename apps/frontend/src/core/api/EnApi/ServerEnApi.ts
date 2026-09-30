import { getServerDataset, getServerToken } from '../AbstractBaseApi/ServerWrapper';
import { EnApi } from './';

export class ServerEnApi extends EnApi {}
ServerEnApi.getToken = getServerToken;
ServerEnApi.getDataset = getServerDataset;
