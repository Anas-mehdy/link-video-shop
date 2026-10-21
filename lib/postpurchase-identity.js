// Never address an order using a mutable customer phone without matching its snapshot.
function normalize(value){let p=String(value||'').replace(/\D/g,'');if(p.startsWith('00'))p=p.slice(2);return p;}
function snapshotPhone(order){
 const c=order?.source_payload?.customer;const raw=normalize(c?.mobile||c?.phone_number||c?.phone);
 if(!raw)return '';
 const prefix=normalize(c.mobile_code||c.dial_code||c.country_code);
 const p=prefix&&!raw.startsWith(prefix)?prefix+raw.replace(/^0/,''):raw;
 return /^[1-9]\d{7,14}$/.test(p)?p:'';
}
function identityReason(order,phone){const source=snapshotPhone(order);return !source?'order_phone_missing':source!==normalize(phone)?'order_phone_mismatch':null;}
module.exports={snapshotPhone,identityReason};
