import { getVersion } from '../../../configuration';
import { titleOf } from '../DatasetsModule/datasets.service';
import { DictReaderService } from './dict-reader.service';
import { DICT_LIMITS } from './config';
import { DictError, parseCommand, quote, status, syntax, textBlock } from './wire';

const HELP = [
  'DEFINE database word',
  'MATCH database strategy word',
  'SHOW DB | DATABASES',
  'SHOW STRAT | STRATEGIES',
  'SHOW INFO database',
  'SHOW SERVER',
  'CLIENT text',
  'STATUS',
  'HELP',
  'OPTION MIME',
  'QUIT',
  'Database selectors: * searches all, ! stops at the first match, in SHOW DB order.',
  'Strategies: exact and prefix; . uses exact. AUTH and SASLAUTH are not supported.',
].join('\n');

/** A session owns MIME state; each command returns a complete bounded response before sending any bytes. */
export class DictProtocol {
  mime = false;
  commands = 0;
  constructor(private readonly reader: DictReaderService) {}

  async command(line: string): Promise<{ text: string; close?: boolean }> {
    this.commands++;
    try {
      const [raw, ...args] = parseCommand(line);
      const name = raw.toUpperCase();
      const arity = (n: number): void => {
        if (args.length !== n) syntax();
      };
      const block = (code: number, message: string, body: string, structured = false): string =>
        status(code, message) + textBlock(body, this.mime, structured) + status(250, 'ok');
      let text: string;
      switch (name) {
        case 'QUIT':
          arity(0);
          return { text: status(221, 'Closing connection'), close: true };
        case 'CLIENT':
          if (!args.length) syntax();
          text = status(250, 'ok');
          break;
        case 'STATUS':
          arity(0);
          text = status(210, `${this.commands} commands processed`);
          break;
        case 'HELP':
          arity(0);
          text = block(113, 'Help follows', HELP);
          break;
        case 'OPTION':
          arity(1);
          if (args[0].toUpperCase() !== 'MIME') throw new DictError(503, 'Option not implemented');
          this.mime = true;
          text = status(250, 'MIME enabled');
          break;
        case 'AUTH':
        case 'SASLAUTH':
          throw new DictError(502, 'Command not implemented');
        case 'SHOW': {
          if (!args.length) syntax();
          const sub = args[0].toUpperCase();
          arity(sub === 'INFO' ? 2 : 1);
          if (sub === 'DB' || sub === 'DATABASES') {
            const databases = await this.reader.read(() => this.reader.databases());
            text = databases.length
              ? block(
                  110,
                  `${databases.length} databases present`,
                  databases.map((db) => `${db.name} ${quote(titleOf(db))}`).join('\n'),
                  true,
                )
              : status(554, 'No databases present');
          } else if (sub === 'STRAT' || sub === 'STRATEGIES') {
            text = block(
              111,
              '2 strategies available',
              'exact "Case-insensitive exact spelling"\nprefix "Case-insensitive spelling prefix"',
              true,
            );
          } else if (sub === 'INFO') {
            text = block(
              112,
              'Database information follows',
              await this.reader.read(() => this.reader.info(args[1])),
            );
          } else if (sub === 'SERVER') {
            text = block(
              114,
              'Server information follows',
              `Vocab Bloom Hub ${getVersion()}\nEnglish dictionary datasets, default first then dataset name.\nAnonymous UTF-8 text service; no authentication or TLS.\n${HELP}\nLimits: ${DICT_LIMITS.matches} matches, ${DICT_LIMITS.definitions} definitions, ${DICT_LIMITS.responseBytes} response bytes. Oversized results return 420, never partial success.`,
            );
          } else throw new DictError(503, 'SHOW parameter not implemented');
          break;
        }
        case 'MATCH': {
          arity(3);
          const strategy = args[1] === '.' ? 'exact' : args[1].toLowerCase();
          const matches = await this.reader.read(() => this.reader.matches(args[0], strategy, args[2]));
          text = matches.length
            ? block(
                152,
                `${matches.length} matches found`,
                matches.map((match) => `${match.database} ${quote(match.word)}`).join('\n'),
                true,
              )
            : status(552, 'No match');
          break;
        }
        case 'DEFINE': {
          arity(2);
          const definitions = await this.reader.read(() => this.reader.definitions(args[0], args[1]));
          text = definitions.length
            ? status(150, `${definitions.length} definitions retrieved`) +
              definitions
                .map(
                  (definition) =>
                    status(
                      151,
                      `${quote(definition.word)} ${definition.database} ${quote(definition.description)}`,
                    ) + textBlock(definition.text, this.mime),
                )
                .join('') +
              status(250, 'ok')
            : status(552, 'No match');
          break;
        }
        default:
          throw new DictError(500, 'Command not recognized');
      }
      if (Buffer.byteLength(text) > DICT_LIMITS.responseBytes)
        throw new DictError(420, 'Response too large; choose one database');
      return { text };
    } catch (error) {
      if (error instanceof DictError) return { text: status(error.code, error.message) };
      throw error;
    }
  }
}
