# Развёртывание

Два способа запустить экземпляр в production: в контейнерах — `docker compose up` с
опубликованными образами, самый простой ([`docker.md`](./docker.md)) — или как обычные
процессы Node.js (эта страница). В обоих случаях впереди стоит reverse proxy с TLS
([`reverse-proxy.md`](./reverse-proxy.md)), а данные хранит Postgres
([`../database.md`](../database.md)).

| Страница                                       | О чём                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------ |
| эта страница                                   | Сборка и запуск двух процессов, пробы, аккуратная остановка, systemd / PM2     |
| [`docker.md`](./docker.md)                     | Три образа, `docker-compose.yml`, первый старт, сборка образов                 |
| [`reverse-proxy.md`](./reverse-proxy.md)       | TLS, один origin для обоих приложений, приватный админский API (Caddy / nginx) |
| [`vps.md`](./vps.md)                           | Чекаут на VPS: сборка образов на месте, обновление через `git pull`            |
| [`examples/`](./examples/)                     | systemd-юниты, файл процессов PM2, nginx для пары хостов сайт + админка        |
| [`../database.md`](../database.md)             | Postgres внутри compose или отдельно, миграции, бэкапы, размер                 |
| [`../environment.md`](../environment.md)       | Все переменные окружения                                                       |
| [`../operations.md`](../operations.md)         | Бэкапы, обновление, откат, обновление датасета                                 |
| [`../observability.md`](../observability.md)   | Метрики (Prometheus + Grafana) и логи                                          |
| [`../offline-import.md`](../offline-import.md) | Загрузка словаря без доступа в интернет                                        |

## Что нужно для production

- **Node.js ≥ 22.13** и Yarn 4 (`corepack enable`).
- **Postgres** — единственная production-база; сервер отказывается стартовать с
  `NODE_ENV=production` на SQLite ([`../database.md`](../database.md)).
- **HTTPS** для всего, что выходит за пределы этого хоста, — cookie админа помечена `secure`,
  только когда вход прошёл по `https://`; по обычному `http://` она передаётся в открытом виде,
  и сервер пишет предупреждение при каждом входе ([`reverse-proxy.md`](./reverse-proxy.md)).

## Окружение

Оба приложения читают один `.env` в корне репозитория. Значения, которые важны в production:

```dotenv
NODE_ENV=production
DATABASE_URL=postgres://user:password@db-host:5432/vocab_bloom
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<длинный случайный секрет>
# origin, который открывает браузер; API под ним отдаёт прокси
NEXT_PUBLIC_BASE_API_URL=https://dict.example.com/api
CORS_ORIGINS=https://dict.example.com
# один reverse proxy перед сервером (см. reverse-proxy.md)
TRUST_PROXY=1
```

> [!IMPORTANT]
> Значения `NEXT_PUBLIC_*` вшиваются в бандл фронтенда при сборке: поменяли — пересоберите
> фронтенд.

Все переменные, их значения по умолчанию и проверки при старте:
[`../environment.md`](../environment.md).

## Сборка и запуск

```bash
yarn install --immutable
yarn build                        # сервер → apps/server/dist, фронтенд → apps/frontend/.next (вшивает NEXT_PUBLIC_*)

yarn start                        # оба процесса в одном терминале (concurrently); останавливает оба, когда один завершился
yarn start:server                 # node apps/server/dist/src/main.js — слушает SERVER_PORT (3010)
yarn start:front                  # next start — слушает PORT (3000)
yarn site:build && yarn start:site # сайт проекта, опционально — слушает SITE_PORT (3020); docker.md#the-website
```

**`ENV_FILE`** (абсолютный путь) загружает другой файл вместо корневого `.env` — для секретов
под `/etc` или сборки, запущенной вне чекаута. На старте сервер пишет в лог, какой файл
загрузил, проверяет конфигурацию (код 1 и сообщение, если чего-то обязательного нет),
применяет ожидающие миграции и логирует базу, CORS-origins, настройку trust-proxy, пути проб,
формат лога и включённые поверхности API. Лог идёт в stdout — JSON-строками в production
([`../observability.md`](../observability.md#logs)). Оба процесса не держат состояния, кроме
базы и, если используется, `DICTIONARY_IMPORT_DIR`.

CI на каждый pull request собирает и запускает production-сборку против Postgres, проверяет
пробы и останавливает её через SIGTERM (`.github/scripts/production-smoke.sh`).

## Пробы

Две пробы под `/api` — без логина, без rate limit, никогда не кэшируются, работают даже при
выключенной поверхности API:

| Проба             | Отвечает                                                                                                                                                                                                           | Для чего                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `GET /api/health` | `200 { "status": "ok", "version": "…" }`, пока процесс обслуживает HTTP                                                                                                                                            | liveness: перезапустить процесс, когда он перестаёт отвечать                                   |
| `GET /api/ready`  | `200 { "status": "ok" }`, когда миграции прошли и база отвечает (`SELECT 1`, бюджет 2 с); иначе `503 { "status": "error", "reason": "database_unreachable" \| "shutting_down" \| "importing" \| "import_failed" }` | readiness: направлять трафик только пока ответ `200`; становится `503`, когда начата остановка |

> [!NOTE]
> `503 database_unreachable` значит, что процесс в порядке, а Postgres — нет: чините базу, а не
> сервер.

У фронтенда своей пробы нет; эквивалент — `GET /en/login` отвечает `200`.

## Остановка и перезапуск

По **SIGTERM** (или SIGINT) сервер:

1. отвечает `503 shutting_down` на `/api/ready`, чтобы балансировщик перестал слать запросы;
2. закрывает listener и даёт завершиться запросам в полёте;
3. закрывает пул Postgres и завершается с кодом 0.

Всё это — в пределах **`SHUTDOWN_TIMEOUT`** секунд (30 по умолчанию); дольше — в логе
`forcing exit` и код 1.

> [!IMPORTANT]
> Дайте менеджеру процессов таймаут остановки _больше_ этого бюджета (`TimeoutStopSec` в systemd,
> `kill_timeout` в PM2), иначе он убьёт процесс раньше.

Перезапуск — работа менеджера: `Restart=always` (systemd), `autorestart` (PM2). Сервер,
который не может стартовать — не хватает конфигурации, недоступна база, — завершается с
кодом 1, и менеджер повторяет попытку; `journalctl` показывает причину. Деплой — это: бэкап,
выложить новую сборку, перезапустить оба процесса, дождаться `200` на `/api/ready`
([`../operations.md`](../operations.md#upgrading-the-code)). Между старым и новым процессом
есть пауза; нулевой простой требует двух экземпляров сервера за прокси, что здесь не описано.

> [!WARNING]
> Запускайте **один экземпляр сервера на базу**: корзины rate limit, защита логина от повторов и
> ожидающие скачивания экспортов живут в памяти процесса. Реплики заработают, но каждая считает
> лимиты сама, а скачивание экспорта, попавшее на другую реплику, не удастся.

## Менеджеры процессов

Готовые к адаптации файлы в [`examples/`](./examples/):

- **systemd** — [`vocab-bloom-hub-server.service`](./examples/vocab-bloom-hub-server.service)
  и [`vocab-bloom-hub-frontend.service`](./examples/vocab-bloom-hub-frontend.service):
  запускают `node` напрямую (без yarn посередине, чтобы сигнал и код выхода были самого
  процесса), `ENV_FILE` / `EnvironmentFile=` указывают на `/etc/vocab-bloom-hub/.env`,
  `TimeoutStopSec` больше `SHUTDOWN_TIMEOUT`, `Restart=always`. Скопируйте в
  `/etc/systemd/system/`, поправьте пути и пользователя,
  `systemctl daemon-reload && systemctl enable --now vocab-bloom-hub-server vocab-bloom-hub-frontend`.
- **PM2** — [`ecosystem.config.cjs`](./examples/ecosystem.config.cjs): оба приложения из одного
  файла, `pm2 start docs/deployment/examples/ecosystem.config.cjs` после `yarn build`, затем
  `pm2 save && pm2 startup`, чтобы подняться после перезагрузки.

Любой супервизор, который передаёт SIGTERM в `yarn start`, работает так же.

## Первые данные

У свежего экземпляра словарь пуст. Два способа его наполнить:

- **Самостоятельно, при первом старте** — `DICTIONARY_AUTO_IMPORT=true` в `.env` (в
  compose-файле включено, при нативном запуске по умолчанию выключено): сервер загружает опубликованный
  датасет с HuggingFace — или самый новый датасет из `DICTIONARY_IMPORT_DIR` — в фоне, логирует
  прогресс и отвечает `503 importing` на `/api/ready`, пока не закончит
  ([`docker.md`](./docker.md#first-start-the-dictionary-loads-itself)).
- **Из админки** — _Import dictionary_: с HuggingFace или из архива, когда у хоста нет доступа
  в интернет ([`../offline-import.md`](../offline-import.md)). Импорт несколько минут стримит
  прогресс; прокси не должен буферизовать этот поток. Одновременно идёт один импорт; второй
  отклоняется с `409`.

## Обновление

Сделайте бэкап базы, заберите новую версию, `yarn install --immutable`, `yarn build`,
перезапустите оба процесса: ожидающие миграции выполняются на старте сервера. Откат — это
восстановление того бэкапа: как только новый сервер выполнил миграции, предыдущая версия схеме
уже не соответствует. Полная процедура:
[`../operations.md`](../operations.md#upgrading-the-code).
