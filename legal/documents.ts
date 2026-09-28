export const legalDocuments=[
 {slug:'privacy',title:'Политика обработки персональных данных',short:'Как LABRICA собирает, использует, хранит и защищает персональные данные.'},
 {slug:'personal-data-consent',title:'Согласие на обработку персональных данных',short:'Состав данных, цели обработки, срок действия и порядок отзыва согласия.'},
 {slug:'terms',title:'Пользовательское соглашение',short:'Правила использования платформы, права и обязанности пользователя.'},
 {slug:'offer',title:'Публичная оферта',short:'Условия подписки, оплаты, автопродления и возврата денежных средств.'},
 {slug:'cookies',title:'Политика использования cookie',short:'Необходимые и аналитические cookie, сроки хранения и управление выбором.'},
 {slug:'marketing-consent',title:'Согласие на рекламные сообщения',short:'Добровольное согласие на новости и предложения LABRICA.'},
 {slug:'ai-improvement-consent',title:'Разрешение на улучшение LABRICA AI',short:'Добровольные условия использования материалов для оценки и улучшения AI.'},
 {slug:'requisites',title:'Реквизиты',short:'Сведения об операторе, контакты, домены и платёжные реквизиты.'},
 {slug:'processors',title:'Обработчики и внешние сервисы',short:'Инфраструктура, интеграции и категории передаваемых данных.'},
 {slug:'data-processing',title:'Поручение на обработку персональных данных',short:'Условия обработки персональных данных по поручению бизнес-пользователя.'},
] as const;

export type LegalSlug=typeof legalDocuments[number]['slug'];
export const legalDocument=(slug:string)=>legalDocuments.find(document=>document.slug===slug);
