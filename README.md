# LABRICA

Отдельный проект LABRICA, извлечённый из общего проекта. Исходники YGROUP, его HTML-входы, тестовые артефакты, `dist`, `.data` и `node_modules` не включены.

## Запуск

```bash
npm install
npm run dev
```

Основные адреса при локальной разработке:

- `/` — лендинг LABRICA
- `/labrika/` — приложение LABRICA
- `/labrika/admin/` — админ-панель LABRICA

## Сборка

```bash
npm run build
```

Результат создаётся в `dist/`.

## Секреты

Не коммитьте `.env`, `.data`, API-ключи и токены. Серверные параметры перечислены в `.env.example`.
