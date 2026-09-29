# Интернет-эквайринг Точки

LABRICA создаёт платёжные ссылки только на сервере. Сумма и тариф берутся из серверного каталога, а не из браузера. Подписка активируется на 30 дней только после того, как API Точки вернул для операции статус `APPROVED`. Возвраты и ручная выдача доступа не записываются как новая выручка.

## 1. Выпустить JWT

В интернет-банке Точки откройте «Сервисы» → «Интеграции и API» и создайте JWT-ключ для своей компании. Нужны разрешения:

- `MakeAcquiringOperation`;
- `ReadAcquiringData`;
- `ReadCustomerData`;
- `ManageWebhookData`.

Сохраните сам JWT и `client_id`. Не добавляйте их в переменные с префиксом `VITE_`, клиентский код или Git. При перевыпуске JWT меняется и `client_id`, поэтому webhook потребуется зарегистрировать повторно.

## 2. Получить идентификаторы

Получите `customerCode` компании:

```sh
curl 'https://enter.tochka.com/uapi/open-banking/v1.0/customers' \
  -H 'Accept: application/json' \
  -H "Authorization: Bearer $TOCHKA_JWT_TOKEN"
```

Используйте `customerCode` объекта с `customerType: "Business"`.

Получите торговую точку интернет-эквайринга:

```sh
curl 'https://enter.tochka.com/uapi/acquiring/v1.0/retailers' \
  -H 'Accept: application/json' \
  -H "Authorization: Bearer $TOCHKA_JWT_TOKEN"
```

Выберите объект со статусом `REG` и `isActive: true`. Его `merchantId` должен относиться именно к интернет-эквайрингу, а не к отдельному СБП-merchant.

## 3. Настроить сервер

В production-окружении backend-процесса задайте:

```dotenv
TOCHKA_API_BASE_URL=https://enter.tochka.com/uapi
TOCHKA_JWT_TOKEN=секретный_JWT_из_Точки
TOCHKA_CLIENT_ID=client_id_ключа
TOCHKA_CUSTOMER_CODE=код_компании
TOCHKA_MERCHANT_ID=merchant_id_торговой_точки
TOCHKA_RECEIPTS_ENABLED=true
TOCHKA_TAX_SYSTEM_CODE=ваша_система_налогообложения
TOCHKA_VAT_TYPE=ваша_ставка_НДС
TOCHKA_PAYMENT_MODES=sbp,card
TOCHKA_REDIRECT_ORIGIN=https://app.labrica.pro
```

Для `TOCHKA_TAX_SYSTEM_CODE` API принимает `osn`, `usn_income`, `usn_income_outcome`, `esn` или `patent`. Для `TOCHKA_VAT_TYPE` используйте ставку из настроек кассы (`none`, `vat0`, `vat5`, `vat7`, `vat10`, `vat22`, `vat105`, `vat107`, `vat110` или `vat122`). Эти два значения нужно подтвердить с бухгалтером: приложение намеренно не выбирает налоговый режим самостоятельно.

Если чеки формирует другая касса, можно задать `TOCHKA_RECEIPTS_ENABLED=false`. В этом случае LABRICA вызывает обычный метод создания платёжной ссылки, но обязанность по фискализации остаётся на внешней кассе.

После изменения окружения перезапустите Node-процесс. В `admin.labrica.pro` → «Настройки» появится статус «Реквизиты заданы». Фактическая доступность API будет отмечена только после первого успешного запроса.

## 4. Зарегистрировать webhook

Webhook должен приходить на публичный HTTPS-адрес:

```text
https://hooks.labrica.pro/api/billing/tochka/webhook
```

Зарегистрируйте его для текущего `client_id`:

```sh
curl -X PUT "https://enter.tochka.com/uapi/webhook/v1.0/$TOCHKA_CLIENT_ID" \
  -H 'Accept: application/json' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOCHKA_JWT_TOKEN" \
  --data '{
    "webhooksList": ["acquiringInternetPayment"],
    "url": "https://hooks.labrica.pro/api/billing/tochka/webhook"
  }'
```

Reverse proxy для `hooks.labrica.pro` должен передавать этот путь в LABRICA backend без изменения тела запроса. Банк присылает подписанный JWT как `text/plain`; сервер проверяет подпись публичным ключом Точки и после этого отдельно запрашивает операцию по `operationId`. Данные webhook сами по себе подписку не активируют.

## 5. Проверить перед запуском

1. Убедитесь, что `https://status.labrica.pro/api/health` отвечает через нужный production-процесс.
2. В админке проверьте карточку «Платежи · Точка»: до первого запроса она покажет «Настроено, не проверено», после успешного запроса — «API отвечает».
3. В кабинете тестового пользователя откройте «Подписка», выберите тариф и перейдите по ссылке Точки.
4. Проведите реальную оплату своей картой/СБП и дождитесь возврата в LABRICA.
5. Проверьте, что операция появилась в «Платежи», подписка активирована, а «Последний webhook» обновился.
6. Возврат тестовой операции выполняйте через Точку. LABRICA отразит его после следующей сверки; автоматического отзыва уже оказанного доступа при возврате сейчас нет.

В production суммы жёстко заданы на сервере: MIN — 4 990 ₽, BUSINESS — 9 990 ₽, PRO — 19 990 ₽. Для отдельного теста на 1 ₽ используйте инструменты/коллекцию Точки, не меняя тарифы публичного кабинета.

## Безопасность и эксплуатация

- JWT хранится только в секретах production-сервера.
- Платёжная ссылка создаётся только для авторизованного владельца пространства.
- LABRICA повторно сверяет `operationId`, сумму, `customerCode` и `merchantId` с API банка.
- Повторный webhook идемпотентен: одна операция не продлевает подписку дважды.
- Автосписания не включены. Каждые 30 дней пользователь создаёт новую платёжную ссылку.
- Локальный реестр операций находится в `.data/payments.json`; каталог `.data` нужно включить в резервное копирование и не публиковать как статику.

Официальные материалы: [интеграция интернет-эквайринга](https://developers.tochka.com/docs/tochka-api/internet-acquiring-integration), [платёжные ссылки](https://developers.tochka.com/docs/tochka-api/opisanie-metodov/platyozhnye-ssylki), [создание ссылки с чеком](https://developers.tochka.com/docs/tochka-api/api/create-payment-operation-with-receipt-acquiring-v-1-0-payments-with-receipt-post), [webhook](https://developers.tochka.com/docs/tochka-api/opisanie-metodov/vebhuki).
