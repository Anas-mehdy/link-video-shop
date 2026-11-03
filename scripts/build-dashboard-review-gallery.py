from pathlib import Path
out=Path('/workspace/link-ui-review/dense')
sections=[('orders','الطلبات'),('customers','العملاء'),('automations','متابعات السلات'),('carthuman','المتابعة البشرية'),('postpurchase','ما بعد البيع'),('coupons','ردود الخصم'),('ads','الإعلانات'),('preorders','الحجز المسبق')]
html='''<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>لنك — مراجعة التصميم ببيانات كثيفة</title><style>body{margin:0;background:#101014;color:#f5f2f8;font:17px/1.8 system-ui}main{max-width:1320px;margin:auto;padding:32px}h1{font-size:28px}p{color:#bbb5c5}a{color:#dfb5f5}nav{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}nav a{padding:8px 16px;background:#33213f;border-radius:8px}section{margin:48px 0;border-top:1px solid #36343f;padding-top:24px}.grid{display:grid;grid-template-columns:minmax(0,1fr) 390px;gap:20px;align-items:start}figure{margin:0;min-width:0;background:#19191f;border:1px solid #36343f;border-radius:12px;overflow:hidden}figcaption{padding:12px 18px}img{display:block;width:100%;height:auto}details{margin:20px 0}summary{cursor:pointer;padding:12px;background:#22212a;border-radius:8px}.extras{display:flex;flex-wrap:wrap;gap:16px}.extras a{display:block;padding:10px;border:1px solid #36343f;border-radius:8px}@media(max-width:900px){main{padding:20px}.grid{grid-template-columns:1fr}.grid figure:last-child{max-width:390px;margin:auto}}:focus-visible{outline:3px solid #21b0f1;outline-offset:4px}</style><main><h1>معاينة لنك — بيانات اختبار كثيفة</h1><p>صور فعلية من Chromium عند 1440 و390 بكسل. جميع الأسماء والأرقام اصطناعية. لا تتصل هذه المعاينة بأي خدمة؛ الأزرار الظاهرة داخل الصور ليست تفاعلية. اضغط الصورة لعرضها بالحجم الأصلي، وافتح التفاصيل لمراجعة الصفحة كاملة.</p><nav>'''
html+=''.join(f'<a href="#{id}">{title}</a>' for id,title in sections)+'</nav>'
for id,title in sections:
 html+=f'<section id="{id}"><h2>{title}</h2><div class="grid">'
 for w in [1440,390]:html+=f'<figure><figcaption>{"سطح المكتب" if w==1440 else "الهاتف"} · {w}px</figcaption><a href="{id}-{w}.png"><img src="{id}-{w}-viewport.png" alt="{title} عند عرض {w}" loading="lazy"></a></figure>'
 html+='</div><details><summary>التفاصيل والإعدادات والصورة الكاملة</summary><div class="extras">'
 for w in [1440,390]:
  html+=f'<a href="{id}-{w}.png">الصفحة كاملة · {w}</a>'
  if (out/f'{id}-{w}-detail.png').exists():html+=f'<a href="{id}-{w}-detail.png">تفاصيل القسم · {w}</a>'
 extras={'orders':['orders-scrolled'],'carthuman':['carthuman-feedback'],'automations':['automation-settings'],'postpurchase':['postpurchase-settings','postpurchase-product'],'ads':['ads-daily'],'preorders':['preorder-editor','preorder-receipt']}.get(id,[])
 for extra in extras:
  for w in [1440,390]:
   if(out/f'{extra}-{w}.png').exists():html+=f'<a href="{extra}-{w}.png">{extra} · {w}</a>'
 html+='</div></details></section>'
html+='</main></html>';(out/'index.html').write_text(html)
