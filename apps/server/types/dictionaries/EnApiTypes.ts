import { ErrorResT } from '../errors';
import { EnWordT } from './en';

export type CheckWordResT = { hasWord: boolean } | ErrorResT;
export type AddResT = EnWordT | ErrorResT;
export type SearchResT = EnWordT[] | ErrorResT;
export type DeleteResT = { success: boolean } | ErrorResT;
