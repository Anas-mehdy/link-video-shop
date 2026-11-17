const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {parseHTML}=require('linkedom');
test('homepage opens direct MP4 with campaign link and stops on close without Salla calls',async()=>{
 const {window}=parseHTML('<html><body><section id="link-video-shop"><a class="lvs-card" data-id="native"></a></section><div id="lvs-viewer"><a class="lvs-close"></a><div><iframe id="lvs-player"></iframe></div><div id="lvs-products"></div></div></body></html>');
 const d=window.document;d.readyState='complete';let calls=0,plays=0,pauses=0;
 const create=d.createElement.bind(d);d.createElement=tag=>{const e=create(tag);if(tag==='video'){e.play=()=>{plays++;return Promise.resolve()};e.pause=()=>pauses++;e.load=()=>{};}return e;};
 const c=vm.createContext({window,document:d,location:{hash:'#lvs-viewer'},MutationObserver:class{observe(){}},AbortSignal,console,fetch:async()=>{calls++;return {ok:true,json:async()=>({ok:true,videos:[{id:'native',media_url:'https://storage.example/movie.mp4',cta_url:'https://linkstore-sa.com/offer'}]})};}});
 vm.runInContext(fs.readFileSync(__dirname+'/../public/video-shop-media.js','utf8'),c);
 await new Promise(r=>setImmediate(r));
 d.querySelector('.lvs-card').dispatchEvent(new window.Event('click',{bubbles:true}));
 await new Promise(r=>setImmediate(r));
 assert.equal(plays,1);assert.equal(d.querySelector('#lvs-direct-player').src,'https://storage.example/movie.mp4');
 assert.equal(d.querySelector('#lvs-media-cta').href,'https://linkstore-sa.com/offer');
 assert.equal(calls,1);
 d.querySelector('.lvs-close').dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(pauses,1);assert.equal(d.querySelector('#lvs-direct-player'),null);
});
