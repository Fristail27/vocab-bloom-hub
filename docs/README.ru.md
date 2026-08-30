<p align="center">
  <img src="../.github/assets/main-readme-logo.svg" alt="Логотип Vocab Bloom Hub" />
</p>

<h1 align="center">Vocab Bloom Hub</h1>

<p align="center">
  Модульная open-source платформа для работы с лексическими данными: словари, лингвистические датасеты и инструменты обработки языка.
</p>

<p align="center">
  <a href="../README.md">English</a> | <strong>Русский</strong>
</p>

<p align="center">
  <a href="https://github.com/Fristail27/vocab-bloom-hub/actions/workflows/check-pull-request.yml"><img src="https://github.com/Fristail27/vocab-bloom-hub/actions/workflows/check-pull-request.yml/badge.svg?branch=main" alt="CI" /></a>
  <a href="https://github.com/Fristail27/vocab-bloom-hub/actions/workflows/codeql.yml"><img src="https://github.com/Fristail27/vocab-bloom-hub/actions/workflows/codeql.yml/badge.svg?branch=main" alt="CodeQL" /></a>
  <a href="../LICENSE"><img src="https://img.shields.io/github/license/Fristail27/vocab-bloom-hub" alt="Лицензия: MIT" /></a>
  <a href="../DATA_LICENSE.md"><img src="https://img.shields.io/badge/data-CC%20BY%204.0-lightgrey" alt="Данные: CC BY 4.0" /></a>
  <a href="https://github.com/Fristail27/vocab-bloom-hub/commits/main"><img src="https://img.shields.io/github/last-commit/Fristail27/vocab-bloom-hub" alt="Последний коммит" /></a>
  <a href="https://github.com/Fristail27/vocab-bloom-hub/issues"><img src="https://img.shields.io/github/issues/Fristail27/vocab-bloom-hub" alt="Открытые issues" /></a>
  <a href="https://github.com/Fristail27/vocab-bloom-hub/pulls"><img src="https://img.shields.io/github/issues-pr/Fristail27/vocab-bloom-hub" alt="Открытые pull requests" /></a>
  <a href="https://github.com/Fristail27/vocab-bloom-hub/stargazers"><img src="https://img.shields.io/github/stars/Fristail27/vocab-bloom-hub?style=flat" alt="Звёзды" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D24-339933?logo=node.js&logoColor=white" alt="Node >= 24" />
  <img src="https://img.shields.io/badge/yarn-4-2C8EBB?logo=yarn&logoColor=white" alt="Yarn 4" />
  <img src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white" alt="NestJS 11" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/tests-Jest%20%7C%20Playwright-C21325?logo=jest&logoColor=white" alt="Jest и Playwright" />
  <a href="../CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PR приветствуются" /></a>
  <a href="../CODE_OF_CONDUCT.md"><img src="https://img.shields.io/badge/code%20of%20conduct-Contributor%20Covenant-5E0D73.svg" alt="Contributor Covenant" /></a>
</p>

---

## 📑 Содержание

- [Обзор](#-обзор)
- [Статус проекта](#-статус-проекта)
- [Возможности](#-возможности)
- [Технологии](#-технологии)
- [Структура репозитория](#-структура-репозитория)
- [Требования](#-требования)
- [Быстрый старт](#-быстрый-старт)
- [Скрипты](#-скрипты)
- [Конфигурация](#️-конфигурация)
- [Деплой](#-деплой)
- [Документация](#-документация)
- [Roadmap](#️-roadmap)
- [Участие в разработке](#-участие-в-разработке)
- [Сообщество](#-сообщество)
- [Лицензия](#-лицензия)

---

## 🚀 Обзор

**Vocab Bloom Hub** — система на основе монорепозитория для построения современной лексической и лингвистической платформы.

Проект вдохновлён структурами вроде WordNet и ставит целью предоставить:

- 📖 Многоязычную словарную базу данных
- 🔎 Быстрый лексический поиск
- 🔗 Граф связей между словами (синонимы, антонимы, гиперонимы и т. д.)
- 📊 Лингвистические датасеты и инструменты
- 🧠 В перспективе — SDK для Python и Node.js

---

## 🚧 Статус проекта

Проект находится на **ранней стадии разработки** (`0.x`). Английский словарь, админ-панель и импорт/экспорт уже пригодны к использованию, но контракт API может меняться между релизами без периода устаревания. Следите за [issues](https://github.com/Fristail27/vocab-bloom-hub/issues) и [pull requests](https://github.com/Fristail27/vocab-bloom-hub/pulls), чтобы видеть, над чем идёт работа.

---

## ✨ Возможности

- **Админ-панель** (английский / русский интерфейс) с тремя разделами:
  - _Managing_ — создание и редактирование английских слов, их значений, переводов, синонимов, антонимов и кратких переводов;
  - _Statistics_ — сводка по содержимому словаря;
  - _Documentation_ — встроенный справочник по модели данных.
- **REST API** с документацией Swagger/OpenAPI: публичный read-only версионированный префикс `/api/v1` для приложений-потребителей (без логина, с лимитом запросов) и админский API, защищённый единственным админским логином (httpOnly JWT-cookie или Bearer-токен) — см. [`api.md`](api.md).
- **Node.js / TypeScript SDK** для публичного API — [`@vocab-bloom-hub/client`](../packages/npm-sdk/README.md): типизированные методы по эндпоинтам, итерация по курсору, типизированные ошибки, ETag-кэш; типы генерируются из закоммиченного OpenAPI-документа (публикация в npm — после альфы, #308).
- **Python SDK** — [`vocab-bloom-hub`](../packages/python-sdk/README.md): sync + async клиенты, pydantic-модели из того же спека, `words_dataframe()` для ноутбуков (публикация в PyPI — после альфы, #310).
- **Импорт / экспорт словаря** в виде NDJSON-датасетов (`POST /api/en/dictionary/import`, `GET /api/en/dictionary/export`) — весь словарь можно версионировать, передавать и переносить между окружениями, в том числе офлайн: из загруженного архива или папки на сервере (см. [`offline-import.md`](offline-import.md)).
- **Поиск** по словам, значениям и переводам.
- **PostgreSQL** в production с миграциями TypeORM, применяемыми при старте, и **SQLite** без настройки для локальной разработки и тестов.
- **Общие типы API** — фронтенд импортирует типы запросов/ответов и коды ошибок напрямую из workspace `server`, поэтому приложения не расходятся.
- **Контроль качества** — ESLint, Prettier, проверка типов, unit-, API- и браузерные e2e-тесты запускаются в CI на каждый pull request; CodeQL сканирует `main`.

---

## 🧰 Технологии

| Слой         | Технологии                                                                                |
| ------------ | ----------------------------------------------------------------------------------------- |
| Фронтенд     | [Next.js 16](https://nextjs.org/) (App Router), React, Ant Design, Sass-модули, next-intl |
| Бэкенд       | [NestJS 11](https://nestjs.com/), TypeORM, Swagger (OpenAPI)                              |
| База данных  | PostgreSQL (production) / SQLite через better-sqlite3 (разработка)                        |
| Тестирование | Jest, Supertest, Playwright                                                               |
| Инструменты  | TypeScript, Yarn 4 workspaces, ESLint 10, Prettier, Husky + lint-staged, Dependabot       |

---

## 🧱 Структура репозитория

```txt
.
├── apps/
│   ├── frontend/   → Админ-панель на Next.js (локали en/ru)
│   ├── server/     → API на NestJS; также экспортирует общие типы (types/) и константы (core/), которые использует фронтенд
│   └── e2e/        → Браузерные тесты Playwright: поднимают оба приложения на изолированной SQLite-базе
├── packages/npm-sdk → @vocab-bloom-hub/client, Node.js / TypeScript SDK публичного API
├── packages/python-sdk → vocab-bloom-hub, Python SDK публичного API (uv, httpx, pydantic)
├── docs/           → Подробная документация (деплой, эксплуатация, окружение, аутентификация, миграции, данные) и этот README на русском
├── eslint/         → Общие части конфигурации ESLint (base / next / nest)
├── .github/        → CI-воркфлоу, шаблоны issue/PR, Dependabot, CODEOWNERS
├── .env            → Единый файл окружения для обоих приложений (не коммитится)
└── package.json    → Скрипты корневого workspace
```

---

## ✅ Требования

- **Node.js >= 24**
- **Yarn 4** (версия зафиксирована в `packageManager`; включите через `corepack enable`)
- **PostgreSQL** — необязательно. Без `DATABASE_URL` сервер использует локальный файл `dev.sqlite`.

---

## ⚡ Быстрый старт

```bash
git clone https://github.com/Fristail27/vocab-bloom-hub.git
cd vocab-bloom-hub
yarn install
```

Создайте файл `.env` в корне репозитория. Минимальная конфигурация для разработки:

```dotenv
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me
NODE_ENV=development
NEXT_PUBLIC_BASE_API_URL=http://localhost:3010/api
```

Затем запустите оба приложения:

```bash
yarn dev
```

- Админ-панель: <http://localhost:3000> (страница входа — `/en/login` или `/ru/login`)
- API: <http://localhost:3010>
- Swagger UI: <http://localhost:3010/api> (отключён в production)

Войдите с логином и паролем из `ADMIN_USERNAME` / `ADMIN_PASSWORD` вашего `.env`. Полный список переменных, включая настройку Postgres, — в [`environment.md`](environment.md).

> **Совет:** SQLite-фолбэк автоматически синхронизирует схему с сущностями, поэтому можно менять модель данных без написания миграций. Переключайтесь на Postgres (и миграции), когда изменение готово, — см. [`migrations.md`](migrations.md).

---

## 📜 Скрипты

Все команды выполняются из корня репозитория.

| Команда                              | Что делает                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `yarn dev`                           | Запуск API и админ-панели вместе (в режиме watch)                                                       |
| `yarn server:dev` / `yarn front:dev` | Только API (порт `SERVER_PORT`, по умолчанию 3010) или только UI (порт `FRONT_PORT`, по умолчанию 3000) |
| `yarn test`                          | Все unit-тесты (сервер + фронтенд)                                                                      |
| `yarn jest --selectProjects server`  | Только серверные тесты (или `frontend`)                                                                 |
| `yarn workspace server test:e2e`     | Серверные e2e-тесты (Supertest на SQLite в памяти)                                                      |
| `yarn e2e` / `yarn e2e:ui`           | Браузерные e2e: production-сборка фронтенда + Playwright (API :3011, UI :3001)                          |
| `yarn lint` / `yarn lint:fix`        | ESLint                                                                                                  |
| `yarn format` / `yarn format:check`  | Prettier                                                                                                |
| `yarn check`                         | `lint` + `format:check` — запускайте перед открытием PR                                                 |

Миграции базы данных (только Postgres, нужен `DATABASE_URL`):

```bash
DATABASE_URL=postgres://... yarn workspace server migration:generate src/db/migrations/MyChange
DATABASE_URL=postgres://... yarn workspace server migration:run      # также migration:revert / migration:show
```

---

## ⚙️ Конфигурация

Единый `.env` в корне репозитория используется обоими приложениями. Основные переменные:

| Переменная                 | Обязательна  | Описание                                                                          |
| -------------------------- | ------------ | --------------------------------------------------------------------------------- |
| `ADMIN_USERNAME`           | да           | Логин администратора                                                              |
| `ADMIN_PASSWORD`           | да           | Пароль администратора; без него сервер не стартует                                |
| `DATABASE_URL`             | в production | `postgres://user:pass@host:5432/db` или `sqlite:<path>`; в dev — фолбэк на SQLite |
| `SERVER_PORT`              | нет (3010)   | Порт API                                                                          |
| `FRONT_PORT`               | нет (3000)   | Порт админ-панели                                                                 |
| `NEXT_PUBLIC_BASE_API_URL` | нет (`/api`) | Базовый URL API для браузера; встраивается на этапе сборки                        |
| `CORS_ORIGINS`             | нет          | Разрешённые origin через запятую                                                  |
| `LOG_LEVEL`                | нет          | `verbose` / `debug` / `log` / `warn` / `error` / `fatal`                          |
| `LOG_FORMAT`               | нет          | `json` (объект на строку; по умолчанию в production) или `pretty` (терминал)      |
| `NODE_ENV`                 | нет          | `production` требует Postgres, делает auth-cookie `secure` и отключает Swagger    |

Полный справочник со значениями по умолчанию и правилами проверки при старте: [`environment.md`](environment.md).

---

## 🚢 Деплой

Два поддерживаемых варианта, оба за reverse proxy, который терминирует TLS и направляет `/api/*` на сервер, а всё остальное — на фронтенд (auth-cookie помечена `secure`, когда вход выполнен по https).

**Docker** — скачать `docker-compose.yml` и `.env.example` (как `.env`, задать пароли), `docker compose up -d`: Postgres, API и админка из опубликованных образов `ghcr.io/fristail27/vocab-bloom-hub-server` / `-frontend` (`main` — dev-сборки, semver-теги с первого релиза), опубликованы на localhost; словарь загружается сам при первом старте (`DICTIONARY_AUTO_IMPORT`, прогресс виден в `/api/ready`). Руководство: [`deployment/docker.md`](deployment/docker.md).

**Нативный Node.js:**

1. Задайте окружение: `NODE_ENV=production`, `DATABASE_URL` со схемой `postgres://`, надёжные `ADMIN_USERNAME` / `ADMIN_PASSWORD`, `NEXT_PUBLIC_BASE_API_URL` и `CORS_ORIGINS` с публичным origin, `TRUST_PROXY=1`.
2. `yarn build`, затем `yarn start` (или `yarn start:server` / `yarn start:front` под systemd или PM2 — примеры файлов в руководстве); неприменённые миграции выполняются при старте сервера. `ENV_FILE` указывает на файл окружения вне репозитория; `GET /api/health` и `GET /api/ready` — пробы; SIGTERM останавливает сервер аккуратно.
3. Поставьте впереди Caddy или nginx — готовые к адаптации конфиги, профили экспозиции (публичный словарь + приватная админка) и чеклист безопасности — в руководстве.

Полное руководство: [`deployment/`](deployment/README.md) → [`reverse-proxy.md`](deployment/reverse-proxy.md).

---

## 📚 Документация

- [`deployment/`](deployment/README.md) — сборка и запуск в production, пробы, аккуратная остановка, systemd / PM2; [`docker.md`](deployment/docker.md): два образа и `docker compose` с Postgres; [`reverse-proxy.md`](deployment/reverse-proxy.md): TLS, конфиги Caddy / nginx, профили экспозиции, приватная админка
- [`operations.md`](operations.md) — эксплуатация инстанса: где хранится состояние и что бэкапить, бэкап базы vs экспорт словаря, обновление и откат, обновление датасета vs обновление кода, размер базы
- [`environment.md`](environment.md) — все переменные окружения, выбор драйвера БД, проверки при старте
- [`authentication.md`](authentication.md) — как устроены вход единственного администратора, login proof и JWT-cookie
- [`migrations.md`](migrations.md) — процесс работы с миграциями TypeORM для Postgres, деплой и решение проблем
- [`offline-import.md`](offline-import.md) — перенос словаря между инстансами без интернета (экспорт → копирование → импорт из файла)
- [`observability.md`](observability.md) — метрики Prometheus и структурированные JSON-логи: включение эндпоинта, как держать его приватным, все метрики, поля лога и request id, отправка логов в систему сбора
- [`performance.md`](performance.md) — задержки горячих чтений на полном словаре (Postgres vs SQLite), индексы за ними, бенчмарк и guard планов запросов
- [`api.md`](api.md) — контракт публичного `/api/v1` (конверт, ошибки, лимит запросов, кэширование, экспорт OpenAPI, устаревшие алиасы) и переключатели public-only / admin-only
- [`data.md`](data.md) — откуда берутся данные словаря (сгенерированы LLM, `generated_by_model`), известные ограничения, как сообщать об ошибках; условия использования — в [`DATA_LICENSE.md`](../DATA_LICENSE.md)
- [`../README.md`](../README.md) — этот README на английском
- Swagger UI по адресу `/api` на запущенном сервере — актуальный справочник API; публичный контракт в формате OpenAPI: [`apps/server/openapi/public-v1.json`](../apps/server/openapi/public-v1.json) или `GET /api/v1/openapi.json`

Документация в `docs/` (кроме этого файла) ведётся на английском языке.

---

## 🗺️ Roadmap

Планируемые направления без строгого порядка (актуальное состояние — в [issues](https://github.com/Fristail27/vocab-bloom-hub/issues)):

- Семантический поиск и семантическая сеть поверх словаря (следующая мажорная версия)
- Граф связей между словами помимо синонимов и антонимов: гиперонимы/гипонимы, коллокации
- Другие исходные языки помимо английского и переводы на языки, отличные от русского
- Публичный read-only API и SDK для Node.js (`npm-sdk`) и Python (`python-sdk`)
- Публикация лингвистических датасетов, собранных из словаря
- Docker-образы и деплой одной командой

---

## 🤝 Участие в разработке

Вклад приветствуется! Ознакомьтесь с [`CONTRIBUTING.md`](../CONTRIBUTING.md) (именование веток, сообщения коммитов, чеклист PR) и [Кодексом поведения](../CODE_OF_CONDUCT.md).

Нашли ошибку или есть идея? Откройте [issue](https://github.com/Fristail27/vocab-bloom-hub/issues/new/choose) — шаблоны подскажут, что заполнить. Каждый pull request проверяется в CI (lint, форматирование, типы, тесты), поэтому сначала запустите `yarn check && yarn test` локально.

---

## 💬 Сообщество

- [GitHub Discussions](https://github.com/Fristail27/vocab-bloom-hub/discussions) — вопросы, идеи, show & tell
- [Issues](https://github.com/Fristail27/vocab-bloom-hub/issues) — сообщения об ошибках и запросы функций

---

## 📄 Лицензия

- **Код** — [MIT](../LICENSE) © Alexey Ryzhov (Fristail27)
- **Данные словаря** (выгрузки, публичный API, датасет на HuggingFace) — [CC BY 4.0](../DATA_LICENSE.md): свободное использование и переработка, в том числе коммерческие, с указанием источника. Данные в основном сгенерированы LLM и не проверены людьми — см. [`data.md`](data.md), прежде чем на них полагаться.
