import {expect,test} from '@playwright/test';

test('публичный лендинг LABRICA запускается отдельно',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle(/LABRICA/);
  await expect(page.getByRole('heading',{name:/AI-студия для вашей SMM-команды/i})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
  expect(errors).toEqual([]);
});

test('кабинет и админка LABRICA доступны в том же проекте',async({page})=>{
  await page.goto('/labrika/?auth=login');
  await expect(page.getByRole('button',{name:'Войти в пространство'})).toBeVisible();
  await page.goto('/labrika/admin/');
  await expect(page.getByRole('heading',{name:'Обзор',exact:true})).toBeVisible();
});
