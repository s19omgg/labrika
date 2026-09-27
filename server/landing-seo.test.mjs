import test from 'node:test';
import assert from 'node:assert/strict';
import {landingSeo} from './landing-seo.mjs';

test('local landing builds never invent a canonical domain',()=>{
 const plugin=landingSeo();const files=[];
 assert.equal(plugin.transformIndexHtml('',{path:'/index.html'}),undefined);
 plugin.generateBundle.call({emitFile:file=>files.push(file)});
 assert.deepEqual(files.map(file=>file.fileName),['robots.txt']);
 assert.doesNotMatch(files[0].source,/Sitemap:/);
});

test('deployment origin describes only the public landing in canonical and sitemap',()=>{
 const plugin=landingSeo('https://content.example.com/');const files=[];
 const tags=plugin.transformIndexHtml('',{path:'/index.html'});
 assert.equal(tags[0].attrs.href,'https://content.example.com/');
 assert.equal(plugin.transformIndexHtml('',{path:'/labrika/index.html'}),undefined);
 plugin.generateBundle.call({emitFile:file=>files.push(file)});
 assert.match(files[0].source,/Sitemap: https:\/\/content\.example\.com\/sitemap\.xml/);
 assert.match(files[1].source,/<loc>https:\/\/content\.example\.com\/<\/loc>/);
 assert.doesNotMatch(files[1].source,/admin|ygroup|labrika/);
});

test('site origin never accepts a non-web protocol or embedded credentials',()=>{
 assert.throws(()=>landingSeo('file:///private/'));
 assert.throws(()=>landingSeo('https://user:password@example.com/'));
});
