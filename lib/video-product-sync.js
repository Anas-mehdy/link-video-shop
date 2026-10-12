const {sb,MERCHANT_ID,fail,redact}=require('./crm');
const sync=require('./salla-sync');
const MAX_PAGES=20;
function money(value){
  const raw=value?.amount??value;
  if(raw==null||raw===''||typeof raw==='object')return null;
  const n=Number(raw);if(!Number.isFinite(n)||n<0)throw fail(503,'مبلغ المنتج غير صالح');return n;
}
function product(p){
  if((typeof p.id==='number'&&!Number.isSafeInteger(p.id))||!/^\d{1,20}$/.test(String(p.id??''))||!p.name)throw fail(503,'بيانات منتج غير صالحة');
  const image=(p.images||[]).find(x=>x.main)||p.images?.[0];
  const sale=money(p.sale_price);
  return {merchant_id:MERCHANT_ID,external_product_id:String(p.id),name:String(p.name),
    sku:p.sku??null,product_type:p.type??null,status:p.status??null,url:p.urls?.customer||p.url||null,
    thumbnail_url:p.thumbnail||image?.url||null,main_image_url:image?.url||p.thumbnail||null,
    currency:p.price?.currency||p.sale_price?.currency||'SAR',price:money(p.price),sale_price:sale>0?sale:null,
    regular_price:money(p.regular_price),is_available:p.is_available===true,
    source_payload:redact(p),updated_at:new Date().toISOString()};
}
async function page(body,{database=sb,credentials=sync.credentials,get=sync.get}={}){
  const number=body.page??1;
  if(!Number.isInteger(number)||number<1||number>MAX_PAGES)throw fail(400,'صفحة المزامنة غير صالحة');
  // Check destination before consuming a Salla request. No scheduler calls this path.
  await database(`products?merchant_id=eq.${MERCHANT_ID}&select=external_product_id&limit=0`);
  const tokens=await credentials();
  const result=await get(`products?page=${number}&per_page=60`,tokens);
  if(!Array.isArray(result.data)||result.data.length>60)throw fail(503,'استجابة المنتجات غير مكتملة');
  const rows=result.data.map(product);
  if(rows.length)await database('products?on_conflict=merchant_id,external_product_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)});
  const next=sync.nextPage(result.pagination,number,rows.length);
  return {saved:rows.length,page:number,next_page:next,done:next===null,requests:1,max_pages:MAX_PAGES};
}
module.exports={page,product,MAX_PAGES};
