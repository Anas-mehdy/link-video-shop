const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('Video ranks normalize ties and zeroes, insert at a position, move both ways, and keep hidden ranks separate',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;
   create table video_shop_videos(id uuid default gen_random_uuid() primary key, merchant_id bigint not null,
   title text not null, sort_order integer not null default 0,is_active boolean not null default true,created_at timestamptz not null default now());
   insert into video_shop_videos(merchant_id,title,sort_order,is_active,created_at) values
   (1,'old',1,true,'2026-01-01'),(1,'newer',1,true,'2026-01-02'),(1,'zero',0,true,'2026-01-01'),
   (1,'hidden',0,false,'2026-01-01'),(2,'other',0,true,'2026-01-01');`);
  const sql=fs.readFileSync(__dirname+'/../video-shop-position.sql','utf8'); await db.exec(sql);
  const expect=async(names,active=true,merchant=1)=>{
   const {rows}=await db.query('select title,sort_order from video_shop_videos where merchant_id=$1 and is_active=$2 order by sort_order',[merchant,active]);
   assert.deepEqual(rows,names.map((title,i)=>({title,sort_order:i+1})));
  };
  await expect(['zero','newer','old']);
  await db.exec("insert into video_shop_videos(merchant_id,title,sort_order) values (1,'latest',1)");
  await expect(['latest','zero','newer','old']);
  await db.exec("update video_shop_videos set sort_order=1 where title='old'");
  await expect(['old','latest','zero','newer']);
  await db.exec("update video_shop_videos set sort_order=3 where title='old'");
  await expect(['latest','zero','old','newer']);
  await db.exec("update video_shop_videos set is_active=false where title='zero'");
  await expect(['latest','old','newer']);await expect(['hidden','zero'],false);
  await db.exec("update video_shop_videos set is_active=true where title='hidden'");
  await expect(['latest','old','newer','hidden']);await expect(['zero'],false);
  await db.exec("delete from video_shop_videos where title='old';insert into video_shop_videos(merchant_id,title,sort_order) values (1,'end',99)");
  await expect(['latest','newer','hidden','end']);await expect(['other'],true,2);
 }finally{await db.close();}
});
