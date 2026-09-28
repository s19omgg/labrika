import {expect,test} from '@playwright/test';

test('публичный лендинг LABRICA запускается отдельно',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle(/LABRICA/);
  await expect(page.getByRole('heading',{name:/AI-студия для вашей SMM-команды/i})).toBeVisible();
  await expect(page.locator('.hero-mascot-animation')).toHaveAttribute('data-mascot-ready','true',{timeout:20000});
  await expect(page.locator('.hero-mascot-animation canvas')).toBeVisible();
  await expect(page.locator('video,.motion-toggle')).toHaveCount(0);
  await expect(page.getByText('ИП Байгот Сергей Русланович',{exact:true})).toBeAttached();
  await expect(page.getByText('ОГРНИП 323440000020443',{exact:true})).toBeAttached();
  await expect(page.getByText('ИНН 440120577981',{exact:true})).toBeAttached();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
  expect(errors).toEqual([]);
});

test('шесть шагов прокрутки показывают макеты вместо скриншотов',async({page})=>{
  await page.goto('/');
  const section=page.locator('#how-it-works');
  await expect(section.getByRole('button')).toHaveCount(6);
  await expect(section.locator('img[src$=".png"]')).toHaveCount(0);
  for(let step=0;step<6;step++){
    await section.evaluate((element,index)=>scrollTo({top:element.getBoundingClientRect().top+scrollY+(element.clientHeight-innerHeight)*(index+.35)/6,behavior:'instant'}),step);
    await expect(section.getByRole('button').nth(step)).toHaveAttribute('aria-current','step');
    await expect(section.locator(`.mockup-slide.is-active[data-mockup-step="${step}"]`)).toHaveCount(2);
  }
  await section.getByRole('button').nth(1).click();
  await expect(section.getByRole('button').nth(1)).toHaveAttribute('aria-current','step');
  await expect(section.locator('.walkthrough-sticky')).toHaveCSS('overflow','visible');
  const cards=await section.locator('.product-window').evaluateAll(elements=>elements.map(element=>{const box=element.getBoundingClientRect();return{left:box.left,right:box.right};}));
  for(const card of cards){expect(card.left).toBeGreaterThanOrEqual(0);expect(card.right).toBeLessThanOrEqual(1440);}
});

test('название компании компактно и выровнено с логотипом',async({page})=>{
  await page.goto('/labrika/?auth=login');
  // Isolated visual fixture: no account is created and no workspace data is seeded.
  await page.evaluate(()=>{
    const host=document.createElement('div');host.className='design-v2 workspace-v3';host.id='brand-alignment-fixture';
    host.innerHTML='<div class="topbar" style="position:relative;width:1000px"><button class="brand-lockup brand-with-company"><span class="labrica-brand labrica-brand-company"><img class="labrica-symbol" src="/brand/labrica-symbol.svg" width="40" height="40" alt=""><span class="labrica-brand-text"><img class="labrica-wordmark" src="/brand/labrica-wordmark.svg" width="126" height="29" alt="LABRICA"><span class="workspace-company"><span class="workspace-company-cross">×</span><span class="workspace-company-name">LABRICA</span></span></span></span></button></div>';
    document.body.append(host);
  });
  await page.evaluate(()=>document.fonts.ready);
  const label=page.locator('#brand-alignment-fixture .workspace-company-name');
  await expect(label).toHaveCSS('font-size','16px');
  const offsets=await page.locator('#brand-alignment-fixture').evaluate(host=>{
    const selectors=['.labrica-symbol','.labrica-wordmark','.workspace-company-name'];
    const centers=selectors.map(selector=>{const box=host.querySelector(selector)!.getBoundingClientRect();return box.top+box.height/2;});
    return centers.map(center=>Math.abs(center-centers[0]));
  });
  offsets.forEach(offset=>expect(offset).toBeLessThan(1));
  await label.evaluate(element=>element.textContent='Очень длинное название компании для проверки выравнивания');
  await expect(label).toHaveCSS('text-overflow','ellipsis');
});

test('подписи и стрелки кнопок выровнены по центру',async({page})=>{
  await page.goto('/');
  await page.evaluate(()=>document.fonts.ready);
  await expect(page.locator('.pricing-card')).toHaveCount(4);
  const positions=await page.locator('.button').evaluateAll(buttons=>buttons.filter(button=>button.getBoundingClientRect().width>0).map(button=>{
    const box=button.getBoundingClientRect();
    const label=button.querySelector('.button-label')?.getBoundingClientRect();
    const icon=button.querySelector('.icon')?.getBoundingClientRect();
    return{label:label?Math.abs(label.top+label.height/2-box.top-box.height/2):999,icon:icon?Math.abs(icon.top+icon.height/2-box.top-box.height/2):999};
  }));
  for(const position of positions){expect(position.label).toBeLessThan(1);expect(position.icon).toBeLessThan(1);}
});

for(const width of [320,390,768])test(`лендинг без горизонтальной прокрутки при ширине ${width}`,async({page})=>{
  await page.setViewportSize({width,height:width===320?667:844});
  await page.goto('/');
  await page.locator('.hero-mascot-animation').scrollIntoViewIfNeeded();
  await expect(page.locator('.hero-mascot-animation')).toHaveAttribute('data-mascot-ready','true',{timeout:20000});
  await expect(page.locator('.hero-mascot-animation canvas')).toBeVisible();
  await page.locator('#how-it-works').evaluate(element=>scrollTo({top:element.getBoundingClientRect().top+scrollY+500,behavior:'instant'}));
  await expect(page.locator('.walkthrough-bottom')).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
  await page.locator('.footer-company').scrollIntoViewIfNeeded();
  await expect(page.getByText('ИНН 440120577981',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
});

test('уменьшенная анимация использует статичный прозрачный кадр и ручные шаги',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  const image=page.locator('.hero-mascot-animation img');
  await expect(image).toHaveAttribute('src',/mascot-3d-poster\.webp$/);
  await expect(page.locator('.hero-mascot-animation canvas')).toHaveCount(0);
  await expect.poll(()=>image.evaluate((node:HTMLImageElement)=>node.complete&&node.naturalWidth>0)).toBe(true);
  const cornerAlpha=await image.evaluate((node:HTMLImageElement)=>{const canvas=document.createElement('canvas');canvas.width=node.naturalWidth;canvas.height=node.naturalHeight;const context=canvas.getContext('2d')!;context.drawImage(node,0,0);return context.getImageData(0,0,1,1).data[3];});
  expect(cornerAlpha).toBe(0);
  await page.locator('#how-it-works').getByRole('button').nth(5).click();
  await expect(page.locator('#how-it-works').getByRole('button').nth(5)).toHaveAttribute('aria-current','step');
  await expect(page.locator('.feature-row').first()).toHaveCSS('transform','none');
});

test('ошибка загрузки анимации заменяется статичным маскотом',async({page})=>{
  await page.route('**/labrica-mascot.glb',route=>route.abort());
  await page.goto('/');
  await expect(page.locator('.hero-mascot-animation img')).toHaveAttribute('src',/mascot-3d-poster\.webp$/);
  await expect.poll(()=>page.locator('.hero-mascot-animation img').evaluate((node:HTMLImageElement)=>node.complete&&node.naturalWidth>0)).toBe(true);
});

test('без WebGL лендинг сохраняет статичного маскота и рабочие ссылки',async({page})=>{
  await page.addInitScript(()=>{
    const getContext=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type:string,...args:unknown[]){
      if(type.startsWith('webgl'))return null;
      return Reflect.apply(getContext,this,[type,...args]);
    } as typeof getContext;
  });
  await page.goto('/');
  const mascot=page.locator('.hero-mascot-animation');
  await expect(mascot).toHaveAttribute('data-mascot-mode','fallback');
  await expect(mascot.locator('img')).toBeVisible();
  await expect(mascot.locator('canvas')).toHaveCount(0);
  await expect(page.locator('.header-signup')).toHaveAttribute('href',/labrika\/\?auth=signup$/);
});

test('маскот проходит сцены и сохраняет финальный жест без цикла',async({page})=>{
  await page.goto('/');
  const mascot=page.locator('.hero-mascot-animation');
  await expect(mascot).toHaveAttribute('data-mascot-ready','true',{timeout:20000});
  await expect(mascot).toHaveAttribute('data-mascot-stage','enter');
  await expect(mascot).toHaveAttribute('data-mascot-stage','glasses',{timeout:10000});
  await expect(mascot).toHaveAttribute('data-mascot-stage','wink',{timeout:10000});
  await expect(mascot).toHaveAttribute('data-mascot-stage','complete',{timeout:15000});
  await page.locator('#how-it-works').scrollIntoViewIfNeeded();
  await mascot.scrollIntoViewIfNeeded();
  await expect(mascot).toHaveAttribute('data-mascot-stage','complete');
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(mascot.locator('canvas')).toHaveCount(0);
  await expect(mascot.locator('img')).toBeVisible();
});

test('кабинет и админка LABRICA доступны в том же проекте',async({page})=>{
  await page.goto('/labrika/?auth=login');
  await expect(page.getByRole('button',{name:'Войти в пространство'})).toBeVisible();
  await page.goto('/labrika/admin/');
  await expect(page.getByRole('heading',{name:'Обзор',exact:true})).toBeVisible();
});
