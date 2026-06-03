import { ErrorCodes } from '../../server/core/constants/error_codes';

export default {
  errors: {
    [ErrorCodes.login_or_pass_wrong]: 'Неправильные имя пользователя или пароль',
    [ErrorCodes.internal_server_error]: 'Что-то пошло не так',
    [ErrorCodes.unparsed_data]: 'Ответ нельзя распарсить',
    [ErrorCodes.failed_fetch]: 'Не удалось выполнить запрос',
  },
  common: {
    theme: {
      light: 'Светлая',
      dark: 'Темная',
    },
    dictionary: 'Словарь',
  },
  login: {
    username: 'Имя пользователя',
    password: 'Пароль',
    sign_in: 'Войти',
    admin_panel_sign_in: 'Вход в панель администратора',
  },
  menu: {
    menu_title: 'Меню',
    main: 'Главная',
    managing: 'Управление',
    statistics: 'Статистика',
  },
  managing: {
    add_word: 'Добавить слово',
    add_phrase: 'Добавить фразу',
    add_grammar_patten: 'Добавить грамматический шаблон',
    edit: 'Редактировать',
  },
  en_managing_words: {
    word: 'Слово',
    part_of_speech: 'Часть речи',
  },
  statistics: {
    common_statistics: 'Общая статистика',
  },
};
