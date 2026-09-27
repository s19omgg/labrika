import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {createCreativeHandler} from './creative-service.mjs';

// Synthetic bytes exercise the adapter/HTTP contract, not image or video encoding.
const image = label => `data:image/png;base64,${Buffer.from(`image-fixture:${label}`).toString('base64')}`;
const video = label => `data:video/webm;base64,${Buffer.from(`video-fixture:${label}`).toString('base64')}`;
const reference = index => ({name:`reference-${index}.png`,data:image(`reference-${index}`)});
const imageBrief = overrides => ({kind:'image',prompt:'A restrained product visual',references:[],...overrides});
const videoBrief = overrides => ({kind:'video',prompt:'A coherent three-scene product story',references:[reference(0)],duration:15,aspect:'9:16',mode:'automatic',topic:'Product launch',postText:'The publication body',brandContext:'Use factual, restrained language.',...overrides});
const scriptFor = brief => ({title:'A complete story',caption:'Publication caption',scenes:Array.from({length:brief.duration/5},(_,index)=>({heading:`Scene ${index+1}`,description:`Original visual direction ${index+1}`,duration:5}))});
function deferred() {let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
function fixtureAdapter(hooks={}) {
  const calls=[];
  const record=(method,input,signal)=>{const call={method,input:structuredClone(input),signal};calls.push(call);return call;};
  const adapter={
    async storyboard(input,signal){const call=record('storyboard',input,signal);await hooks.storyboard?.(call);return hooks.script?.(input)??scriptFor(input);},
    async image(input,signal){const call=record('image',input,signal);await hooks.image?.(call);return {image:image(`render-${calls.length}`)};},
    async keyframe(input,signal){const call=record('keyframe',input,signal);await hooks.keyframe?.(call);return {image:image(`scene-${input.scene.id}-render-${calls.length}`)};},
    async animate(input,signal){const call=record('animate',input,signal);await hooks.animate?.(call);return {video:video(`scene-${input.scene.id}-render-${calls.length}`)};},
    async compose(input,signal){const call=record('compose',input,signal);await hooks.compose?.(call);return {video:video(`final-render-${calls.length}`),duration:hooks.duration?.(input)??input.brief.duration};},
  };
  return {adapter,calls};
}
async function start(t,adapter) {
  const handler=createCreativeHandler({adapter});
  const server=createServer((req,res)=>void handler(req,res,()=>{res.writeHead(404);res.end();}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  const base=`http://127.0.0.1:${server.address().port}`;
  async function request(path,{method='GET',input,token,headers={}}={}) {
    const response=await fetch(`${base}/api/creative${path}`,{method,headers:{...(input!==undefined?{'Content-Type':'application/json'}:{}),...(token!==undefined?{'X-Creative-Token':token}:{}),...headers},...(input!==undefined?{body:JSON.stringify(input)}:{})});
    return {status:response.status,body:await response.json(),headers:response.headers};
  }
  const create=input=>request('/jobs',{method:'POST',input});
  const read=job=>request(`/jobs/${job.id}`,{token:job.token});
  async function waitFor(job,predicate,label='expected job state') {
    const deadline=Date.now()+2000;let response;
    do{response=await read(job);if(predicate(response))return response;await delay(5);}while(Date.now()<deadline);
    assert.fail(`${label} not reached: ${JSON.stringify(response?.body)}`);
  }
  return {request,create,read,waitFor};
}

// No configured provider may return a successful or synthetic generation.
test('disconnected service advertises capability state and returns 503 without a job',async t=>{
  const api=await start(t,null);
  const capabilities=await api.request('/capabilities');
  assert.equal(capabilities.status,200);
  assert.equal(capabilities.body.configured,false);
  assert.equal(capabilities.body.referenceLimit,10);
  assert.deepEqual(capabilities.body.durations,[15,30,45,60]);
  for(const input of [imageBrief(),videoBrief()]) {
    const response=await api.create(input);
    assert.equal(response.status,503);
    assert.match(response.body.error,/не подключён/);
    assert.equal(response.body.id,undefined);
    assert.equal(response.body.result,undefined);
  }
});

test('reference validation rejects more than 10 files and passes exactly 10 unchanged to the adapter',async t=>{
  const fixture=fixtureAdapter();const api=await start(t,fixture.adapter);
  const invalid=await api.create(imageBrief({references:Array.from({length:11},(_,index)=>reference(index))}));
  assert.equal(invalid.status,400);
  assert.equal(fixture.calls.length,0);
  const invalidMime=await api.create(imageBrief({references:[{name:'not-an-image.svg',data:'data:image/svg+xml;base64,PHN2Zz4='}]}));
  assert.equal(invalidMime.status,400);
  const refs=Array.from({length:10},(_,index)=>reference(index));
  const accepted=await api.create(imageBrief({references:refs}));
  assert.equal(accepted.status,202);
  const complete=await api.waitFor(accepted.body,response=>response.body.status==='complete');
  assert.match(complete.body.result,/^data:image\/png;base64,/);
  assert.deepEqual(fixture.calls.map(call=>call.method),['image']);
  assert.deepEqual(fixture.calls[0].input.references,refs);
});

test('job token scopes read, continue, scene changes and cancellation without leaking credentials',async t=>{
  const fixture=fixtureAdapter();const api=await start(t,fixture.adapter);
  const created=await api.create(videoBrief({mode:'review'}));const job=created.body;
  await api.waitFor(job,response=>response.body.status==='review');
  assert.match(job.token,/^[a-f0-9]{64}$/);
  const other=(await api.create(imageBrief())).body;
  for(const token of [undefined,'wrong-token','0'.repeat(64),other.token,'é'.repeat(64)]) {
    assert.equal((await api.request(`/jobs/${job.id}`,{token})).status,404,`Read rejected for ${token===undefined?'missing':'invalid'} token`);
    assert.equal((await api.request(`/jobs/${job.id}`,{method:'DELETE',token})).status,404);
    assert.equal((await api.request(`/jobs/${job.id}/continue`,{method:'POST',token,input:{scenes:[]}})).status,404);
    assert.equal((await api.request(`/jobs/${job.id}/scene`,{method:'POST',token,input:{id:'1',description:'Changed'}})).status,404);
  }
  const authorized=await api.read(job);
  assert.equal(authorized.status,200);
  assert.equal(authorized.body.status,'review');
  assert.equal(authorized.body.token,undefined);
  assert.equal(authorized.body.input,undefined);
  assert.equal(authorized.body.abort,undefined);
  assert.equal(authorized.headers.get('cache-control'),'no-store');
  assert.equal((await api.request(`/jobs/${job.id}/continue`,{method:'POST',token:job.token,input:{scenes:authorized.body.scenes},headers:{Origin:'https://unrelated.example'}})).status,403);
});

test('review mode pauses after the storyboard and uses edited scene descriptions and durations on continue',async t=>{
  const fixture=fixtureAdapter();const api=await start(t,fixture.adapter);
  const job=(await api.create(videoBrief({mode:'review'}))).body;
  const review=await api.waitFor(job,response=>response.body.status==='review');
  assert.equal(review.body.result,undefined);
  assert.deepEqual(fixture.calls.map(call=>call.method),['storyboard']);
  const scenes=review.body.scenes.map((scene,index)=>({...scene,heading:`Edited heading ${index+1}`,description:`Edited scene ${index+1}`,duration:[3,5,7][index]}));
  const continued=await api.request(`/jobs/${job.id}/continue`,{method:'POST',token:job.token,input:{scenes}});
  assert.equal(continued.status,202);
  const complete=await api.waitFor(job,response=>response.body.status==='complete');
  assert.equal(complete.body.duration,15);
  assert.equal(complete.body.scenes.reduce((sum,scene)=>sum+scene.duration,0),15);
  assert.deepEqual(complete.body.scenes.map(scene=>scene.description),scenes.map(scene=>scene.description));
  assert.deepEqual(fixture.calls.filter(call=>call.method==='keyframe').map(call=>call.input.scene.duration),[3,5,7]);
  assert.deepEqual(fixture.calls.filter(call=>call.method==='animate').map(call=>call.input.scene.heading),scenes.map(scene=>scene.heading));
  assert.equal((await api.request(`/jobs/${job.id}/continue`,{method:'POST',token:job.token,input:{scenes}})).status,409);
});

test('invalid edited storyboard returns a client error and leaves review available',async t=>{
  const fixture=fixtureAdapter();const api=await start(t,fixture.adapter);
  const job=(await api.create(videoBrief({mode:'review'}))).body;
  const review=await api.waitFor(job,response=>response.body.status==='review');
  for(const scenes of [[],review.body.scenes.map(scene=>({...scene,duration:1})),review.body.scenes.map(scene=>({...scene,description:''}))]) {
    const response=await api.request(`/jobs/${job.id}/continue`,{method:'POST',token:job.token,input:{scenes}});
    assert.equal(response.status,400);
    assert.equal((await api.read(job)).body.status,'review');
  }
  assert.deepEqual(fixture.calls.map(call=>call.method),['storyboard']);
});

test('automatic video exposes actual script, visuals, animation and montage stages before ready',async t=>{
  const gates={storyboard:deferred(),keyframe:deferred(),animate:deferred(),compose:deferred()};
  t.after(()=>Object.values(gates).forEach(gate=>gate.resolve()));
  const fixture=fixtureAdapter(Object.fromEntries(Object.entries(gates).map(([name,gate])=>[name,()=>gate.promise])));
  const api=await start(t,fixture.adapter);
  const brief=videoBrief({duration:30,aspect:'16:9'});const job=(await api.create(brief)).body;
  assert.equal((await api.read(job)).body.stage,'script');
  gates.storyboard.resolve();
  await api.waitFor(job,response=>response.body.stage==='visuals');
  assert.equal((await api.read(job)).body.result,undefined);
  assert.equal(fixture.calls.filter(call=>call.method==='animate').length,0);
  gates.keyframe.resolve();
  await api.waitFor(job,response=>response.body.stage==='animation');
  assert.equal(fixture.calls.filter(call=>call.method==='keyframe').length,6);
  assert.equal(fixture.calls.filter(call=>call.method==='compose').length,0);
  gates.animate.resolve();
  await api.waitFor(job,response=>response.body.stage==='montage');
  assert.equal(fixture.calls.filter(call=>call.method==='animate').length,6);
  assert.equal((await api.read(job)).body.result,undefined);
  gates.compose.resolve();
  const complete=await api.waitFor(job,response=>response.body.status==='complete');
  assert.equal(complete.body.stage,'ready');assert.equal(complete.body.duration,30);assert.equal(complete.body.aspect,'16:9');
  assert.match(complete.body.result,/^data:video\/webm;base64,/);
  assert.deepEqual(fixture.calls.map(call=>call.method),['storyboard',...Array(6).fill('keyframe'),...Array(6).fill('animate'),'compose']);
  const montage=fixture.calls.find(call=>call.method==='compose').input;
  assert.equal(montage.scenes.reduce((sum,scene)=>sum+scene.duration,0),30);
  assert.ok(montage.scenes.every(scene=>scene.image&&scene.clip));
  assert.deepEqual(montage.brief.references,brief.references);
  assert.equal(montage.brief.brandContext,brief.brandContext);
  assert.equal(montage.brief.postText,brief.postText);
  assert.equal(montage.title,'A complete story');
  const keyframes=fixture.calls.filter(call=>call.method==='keyframe');
  assert.equal(keyframes[1].input.previous,montage.scenes[0].image);
  assert.equal(keyframes[1].input.first,montage.scenes[0].image);
});

for(const duration of [15,30,45,60]) {
  test(`finished video preserves selected ${duration}-second duration`,async t=>{
    const fixture=fixtureAdapter();const api=await start(t,fixture.adapter);
    const job=(await api.create(videoBrief({duration}))).body;
    const complete=await api.waitFor(job,response=>response.body.status==='complete');
    assert.equal(complete.body.duration,duration);
    assert.equal(complete.body.scenes.reduce((sum,scene)=>sum+scene.duration,0),duration);
    assert.equal(fixture.calls.at(-1).input.brief.duration,duration);
  });
}

test('a storyboard or encoded result with the wrong duration never becomes a completed video',async t=>{
  for(const phase of ['storyboard','compose']) {
    await t.test(phase,async t=>{
      const fixture=fixtureAdapter(phase==='storyboard'?{script:input=>({...scriptFor(input),scenes:[{description:'Too short',duration:5}]})}:{duration:input=>input.brief.duration-1});
      const api=await start(t,fixture.adapter);const job=(await api.create(videoBrief())).body;
      const failed=await api.waitFor(job,response=>response.body.status==='error');
      assert.match(failed.body.error,/длительност/i);
      assert.equal(failed.body.result,undefined);
      assert.notEqual(failed.body.stage,'ready');
      if(phase==='storyboard')assert.deepEqual(fixture.calls.map(call=>call.method),['storyboard']);
    });
  }
});

test('single-scene regeneration updates only its keyframe and clip, then recomposes all scenes',async t=>{
  const fixture=fixtureAdapter();const api=await start(t,fixture.adapter);
  const job=(await api.create(videoBrief())).body;
  const original=(await api.waitFor(job,response=>response.body.status==='complete')).body;
  const originalCompose=structuredClone(fixture.calls.at(-1).input);const before=fixture.calls.length;
  const regenerated=await api.request(`/jobs/${job.id}/scene`,{method:'POST',token:job.token,input:{id:'2',description:'Only the middle scene changes'}});
  assert.equal(regenerated.status,202);
  const complete=(await api.waitFor(job,response=>response.body.status==='complete')).body;
  const extra=fixture.calls.slice(before);
  assert.deepEqual(extra.map(call=>call.method),['keyframe','animate','compose']);
  assert.equal(extra[0].input.scene.id,'2');assert.equal(extra[1].input.scene.id,'2');
  assert.equal(extra[0].input.scene.description,'Only the middle scene changes');
  assert.equal(complete.scenes[0].image,original.scenes[0].image);
  assert.equal(complete.scenes[2].image,original.scenes[2].image);
  assert.notEqual(complete.scenes[1].image,original.scenes[1].image);
  const recomposed=extra[2].input;
  assert.equal(recomposed.scenes.length,3);
  assert.equal(recomposed.scenes[0].clip,originalCompose.scenes[0].clip);
  assert.equal(recomposed.scenes[2].clip,originalCompose.scenes[2].clip);
  assert.notEqual(recomposed.scenes[1].clip,originalCompose.scenes[1].clip);
  assert.equal(recomposed.scenes.reduce((sum,scene)=>sum+scene.duration,0),15);
  assert.notEqual(complete.result,original.result);
});

test('scene regeneration is unavailable for an image job',async t=>{
  const fixture=fixtureAdapter();const api=await start(t,fixture.adapter);const job=(await api.create(imageBrief())).body;
  await api.waitFor(job,response=>response.body.status==='complete');
  const response=await api.request(`/jobs/${job.id}/scene`,{method:'POST',token:job.token,input:{id:'1',description:'A new direction'}});
  assert.equal(response.status,409);
  assert.deepEqual(fixture.calls.map(call=>call.method),['image']);
});

test('cancellation aborts adapter work and prevents later animation or montage, even if the adapter resolves late',async t=>{
  const gate=deferred();t.after(()=>gate.resolve());
  const fixture=fixtureAdapter({keyframe:()=>gate.promise});const api=await start(t,fixture.adapter);
  const job=(await api.create(videoBrief())).body;
  await api.waitFor(job,response=>response.body.stage==='visuals');
  const keyframe=fixture.calls.find(call=>call.method==='keyframe');
  assert.ok(keyframe);assert.equal(keyframe.signal.aborted,false);
  const response=await api.request(`/jobs/${job.id}`,{method:'DELETE',token:job.token});
  assert.equal(response.status,200);assert.equal(response.body.cancelled,true);
  assert.equal(keyframe.signal.aborted,true);
  assert.equal((await api.read(job)).status,404);
  gate.resolve();await delay(20);
  assert.deepEqual(fixture.calls.map(call=>call.method),['storyboard','keyframe']);
  assert.equal((await api.request(`/jobs/${job.id}/continue`,{method:'POST',token:job.token,input:{scenes:[]}})).status,404);
});
