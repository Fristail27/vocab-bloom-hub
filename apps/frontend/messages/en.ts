import { ErrorCodes } from '../../server/core/constants/error_codes';

export default {
  errors: {
    [ErrorCodes.login_or_pass_wrong]: 'Login or password is wrong',
    [ErrorCodes.internal_server_error]: 'Internal server error',
    [ErrorCodes.unparsed_data]: 'Unparsed data',
    [ErrorCodes.failed_fetch]: 'Fetch failed',
  },
  common: {
    theme: {
      light: 'light',
      dark: 'dark',
    },
    dictionary: 'Dictionary',
  },
  login: {
    username: 'Username',
    password: 'Password',
    sign_in: 'Sign In',
    admin_panel_sign_in: 'Admin Panel Sign In',
  },
  menu: {
    menu_title: 'Menu',
    main: 'Main',
    managing: 'Managing',
    statistics: 'Statistics',
  },
  managing: {
    add_word: 'Add word',
    add_phrase: 'Add phrase',
    add_grammar_patten: 'Add grammar patten',
    edit: 'Edit data',
  },
  statistics: {
    common_statistics: 'Common statistics',
  },
};
