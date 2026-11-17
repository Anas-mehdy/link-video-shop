const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {parseHTML}=require('linkedom');
function harness(upload,fetch){
 const html=fs.readFileSync(__dirname+'/../public/admin.html','utf8'),{window}=parseHTML(html),document=window.document;
 for(const id of ['formHeading','title']){document.getElementById(id).scrollIntoView=()=>{};document.getElementById(id).focus=()=>{};}
 const c=vm.createContext({window,document,sessionStorage:{getItem:()=>''},LinkAuth:{init:()=>new Promise(()=>{}),fetch},VideoUpload:upload,confirm:()=>true,setTimeout,clearTimeout,URL,console});
 vm.runInContext([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n'),c);
 return {c,document};
}
test('admin media replacement preserves product associations and cancel clears pending state',async()=>{
 let reset=0,filled,write;
 const h=harness({reset:()=>reset++,fill:v=>filled=v,checking:()=>false,hasVideo:()=>true,prepare:async()=>({media_path:'1829345766/new.mp4'})},async(url,opt)=>{if(opt?.method==='PATCH')write=JSON.parse(opt.body);return {ok:true,json:async()=>({videos:[]})};});
 vm.runInContext("videosById.set('video1',{id:'video1',title:'قديم',media_url:'https://storage.example/video.mp4',product_ids:[123],product_names:{123:'كفر'},sort_order:2});editVideo('video1')",h.c);
 assert.equal(filled.id,'video1');
 await vm.runInContext("createVideo()",h.c);
 assert.equal(write.id,'video1');assert.equal(write.media_path,'1829345766/new.mp4');
 assert.equal(Object.hasOwn(write,'product_ids'),false);assert.ok(reset>=2);assert.equal(h.document.getElementById('mediaFile').disabled,false);
});
test('upload failure retains form content and re-enables save without saving a record',async()=>{
 let writes=0;
 const h=harness({checking:()=>false,hasVideo:()=>true,prepare:async()=>{throw Error('رفع غير مكتمل');}},async()=>{writes++;throw Error('unexpected');});
 h.document.getElementById('title').value='جديد';h.document.getElementById('sort').value='1';
 await vm.runInContext('createVideo()',h.c);
 assert.equal(writes,0);assert.equal(h.document.getElementById('title').value,'جديد');
 assert.match(h.document.getElementById('formStatus').textContent,/رفع غير مكتمل/);
 assert.equal(h.document.getElementById('saveVideo').disabled,false);
});
