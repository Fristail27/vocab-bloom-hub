import {AuthApi} from "./";
import {getServerToken} from "../AbstractBaseApi/ServerWrapper";

export class ServerAuthApi extends AuthApi {}
ServerAuthApi.getToken = getServerToken;