import { getServerToken } from '../AbstractBaseApi/ServerWrapper';
import { AuthApi } from './';

export class ServerAuthApi extends AuthApi {}
ServerAuthApi.getToken = getServerToken;
