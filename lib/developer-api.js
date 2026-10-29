const crypto=require('node:crypto');
const {sb,json,fail,MERCHANT_ID,bodyObject}=require('./crm');
const SCOPES=['store','products','variants','categories','orders','customers','carts'];
const META='id,name,key_prefix,scopes,created_at,expires_at,revoked_at,last_used_at,total_requests';
const hash=key=>crypto.createHash('sha256').update(key).digest('hex');
const numeric=v=>typeof v==='string'&&/^[0-9]{1,20}$/.test(v);
const config={
 store:{table:'stores',select:'name,domain,timezone,currency',order:'merchant_id.asc'},
 products:{table:'products',select:'external_product_id,name,sku,product_type,status,url,thumbnail_url,main_image_url,currency,price,sale_price,regular_price,quantity,unlimited_quantity,is_available,rating,ratings_count,source_updated_at,updated_at',id:'external_product_id',order:'external_product_id.asc'},
 variants:{table:'product_variants',select:'external_variant_id,sku,currency,price,sale_price,regular_price,stock_quantity,unlimited_quantity,related_option_ids,related_option_value_ids,source_updated_at,updated_at',id:'external_variant_id',order:'external_variant_id.asc'},
 orders:{table:'orders',select:'external_order_id,order_reference,status,status_slug,payment_status,payment_method,currency,total_amount,ordered_at,updated_at',id:'external_order_id',order:'ordered_at.desc,id.desc',date:'ordered_at'},
 customers:{table:'customers',select:'external_customer_id,name,first_name,last_name,phone,email,city,orders_count,total_spent,last_order_at,updated_at',id:'external_customer_id',order:'id.asc',date:'crm_scope_at'},
 carts:{table:'abandoned_carts',select:'external_cart_id,customer_name,phone,email,currency,total_amount,items_count,status,abandoned_at,recovered_at,updated_at',id:'external_cart_id',order:'abandoned_at.desc,id.desc',date:'abandoned_at'}
};
function queryParams(query){
 const allowed=new Set(['resource','dataset','page','per_page','id','product_id']);
 for(const [k,v] of Object.entries(query||{}))if(!allowed.has(k)||typeof v!=='string')throw fail(400,'Invalid query parameter');
 const dataset=query.dataset||'products';if(!SCOPES.includes(dataset))throw fail(400,'Unknown dataset');
 const page=query.page||'1',size=query.per_page||'50';
 if(!/^[1-9][0-9]{0,3}$/.test(page)||Number(page)>1000||!/^[1-9][0-9]{0,2}$/.test(size)||Number(size)>100)throw fail(400,'Invalid pagination');
 if(query.id&&!numeric(query.id)||query.product_id&&!numeric(query.product_id))throw fail(400,'Invalid identifier');
 if(query.id&&['store','categories'].includes(dataset)||query.product_id&&dataset!=='variants')throw fail(400,'Unsupported filter');
 return {dataset,page:Number(page),size:Number(size)};
}
function shape(row,dataset){
 const out={};const columns=dataset==='categories'?['id','name']:(config[dataset]?.select||'').split(',');
 for(const column of columns)if(Object.hasOwn(row,column))out[column]=row[column];
 const id=config[dataset]?.id;if(id){out.id=String(out[id]);delete out[id];}
 return out;
}
async function rowsFor(query,{database=sb,now=Date.now()}={}){
 const {dataset,page,size}=queryParams(query);
 if(dataset==='categories'){
  // Local category names only, no arbitrary source_payload passthrough.
  const records=await database('rpc/crm_developer_categories',{method:'POST',body:JSON.stringify({p_merchant_id:MERCHANT_ID,p_offset:(page-1)*size,p_limit:size+1})});
  return {data:records.slice(0,size).map(r=>shape(r,dataset)),has_more:records.length>size,page,per_page:size};
 }
 const c=config[dataset],params=new URLSearchParams({merchant_id:'eq.'+MERCHANT_ID,select:c.select,order:c.order,limit:String(size+1),offset:String((page-1)*size)});
 if(c.date)params.set(c.date,'gte.'+new Date(now-30*86400000).toISOString());
 if(query.id)params.set(c.id,'eq.'+query.id);
 if(dataset==='variants'){
  if(!query.product_id)throw fail(400,'product_id is required for variants');
  const product=await database('products?'+new URLSearchParams({merchant_id:'eq.'+MERCHANT_ID,external_product_id:'eq.'+query.product_id,select:'id',limit:'1'}));
  if(!product.length)return {data:[],has_more:false,page,per_page:size};
  params.set('product_id','eq.'+product[0].id);
 }
 const records=await database(c.table+'?'+params);
 return {data:records.slice(0,size).map(r=>shape(r,dataset)),has_more:records.length>size,page,per_page:size};
}
async function handle(req,res,{database=sb}={}){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 try{
  if(req.method!=='GET')return json(res,405,{ok:false,error:'Read-only API: use GET'},{Allow:'GET'});
  const {dataset}=queryParams(req.query||{});
  const bearer=String(req.headers.authorization||'');if(!/^Bearer lnk_ro_[a-f0-9]{64}$/.test(bearer))throw fail(401,'Invalid API key');
  const result=await database('rpc/crm_developer_consume',{method:'POST',body:JSON.stringify({p_merchant_id:MERCHANT_ID,p_hash:hash(bearer.slice(7)),p_scope:dataset})});
  if(result.status!==200)return json(res,[401,403,429].includes(result.status)?result.status:503,{ok:false,error:result.status===429?'Rate limit exceeded':result.status===403?'Dataset not granted':'Invalid or expired API key'},result.status===429?{'Retry-After':String(result.retry_after||60)}:{});
  res.setHeader('X-RateLimit-Remaining-Minute',String(result.remaining_minute));
  res.setHeader('X-RateLimit-Remaining-Day',String(result.remaining_day));
  return json(res,200,{ok:true,...await rowsFor(req.query||{},{database}),source:'local_snapshot',salla_requests:0,generated_at:new Date().toISOString(),notice:'Cached data; not a live inventory or checkout guarantee. Orders, customers and carts cover the last 30 days.'});
 }catch(e){return json(res,[400,401,403].includes(e.statusCode)?e.statusCode:503,{ok:false,error:[400,401,403].includes(e.statusCode)?e.message:'API temporarily unavailable'});}
}
async function admin(req,res,{database=sb}={}){
 // Caller must already have passed requireAdmin. No raw key can be retrieved later.
 if(req.method==='GET')return json(res,200,{ok:true,keys:await database('crm_developer_keys?'+new URLSearchParams({merchant_id:'eq.'+MERCHANT_ID,select:META,order:'created_at.desc',limit:'100'})),limits:{per_minute:60,per_day:3000},scopes:SCOPES});
 if(req.method!=='POST'&&req.method!=='DELETE')return json(res,405,{ok:false,error:'Method not allowed'});
 const b=bodyObject(req);
 if(req.method==='DELETE'){
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(b.id||''))throw fail(400,'Invalid key id');
  await database('crm_developer_keys?'+new URLSearchParams({merchant_id:'eq.'+MERCHANT_ID,id:'eq.'+b.id,revoked_at:'is.null'}),{method:'PATCH',body:JSON.stringify({revoked_at:new Date().toISOString()})});return json(res,200,{ok:true});
 }
 const name=typeof b.name==='string'?b.name.trim():'';
 if(!name||name.length>80||!Array.isArray(b.scopes)||!b.scopes.length||b.scopes.length>7||b.scopes.some(s=>!SCOPES.includes(s)))throw fail(400,'حدد اسم المفتاح وصلاحيات القراءة');
 const active=await database('crm_developer_keys?'+new URLSearchParams({merchant_id:'eq.'+MERCHANT_ID,revoked_at:'is.null',expires_at:'gt.'+new Date().toISOString(),select:'id',limit:'20'}));
 if(active.length>=20)throw fail(400,'ألغِ مفتاحًا قديمًا قبل إنشاء مفتاح آخر');
 const key='lnk_ro_'+crypto.randomBytes(32).toString('hex'),key_hash=hash(key);
 const keys=await database('crm_developer_keys',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({merchant_id:MERCHANT_ID,name,key_hash,key_prefix:key.slice(0,15),scopes:[...new Set(b.scopes)]})});
 return json(res,201,{ok:true,key,metadata:Object.fromEntries(META.split(',').map(k=>[k,keys[0][k]]))});
}
module.exports={handle,admin,rowsFor,queryParams,hash,shape};
