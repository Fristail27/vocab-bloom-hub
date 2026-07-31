import { getServerToken } from '../AbstractBaseApi/ServerWrapper';
import { SettingsApi } from './';

export class ServerSettingsApi extends SettingsApi {}
ServerSettingsApi.getToken = getServerToken;
