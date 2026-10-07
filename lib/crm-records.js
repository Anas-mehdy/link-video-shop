const { sb, fail, MERCHANT_ID } = require('./crm');

// Explicit columns from the merchant's schema export (2026-10-06).
// Raw source_payload and webhook credentials are deliberately not returned.
const resources = {
  orders: { table: 'orders', select: 'id,external_order_id,order_reference,status,status_slug,payment_status,payment_method,currency,total_amount,ordered_at,created_at', search: ['external_order_id','order_reference'], order: 'ordered_at.desc.nullslast,id.desc' },
  customers: { table: 'customers', select: 'id,external_customer_id,name,first_name,last_name,phone,email,city,orders_count,total_spent,last_order_at,created_at', search: ['name','first_name','last_name','phone','email','external_customer_id'], order: 'created_at.desc,id.desc' },
  carts: { table: 'abandoned_carts', select: 'id,external_cart_id,customer_name,phone,email,currency,total_amount,items_count,status,abandoned_at,last_contact_at,recovered_at,created_at', search: ['external_cart_id','customer_name','phone','email'], order: 'abandoned_at.desc.nullslast,id.desc' },
};
async function listRecords(resource, query) {
  const config = resources[resource];
  const page = String(query.page ?? '1'), search = query.search ?? '';
  if (!/^\d{1,4}$/.test(page) || Number(page) < 1 || Number(page) > 1000 || typeof search !== 'string' || search.length > 100) throw fail(400, 'معايير البحث أو رقم الصفحة غير صالح');
  // Reject PostgREST grammar/wildcard characters rather than interpolating them.
  if (!/^[\p{L}\p{N}\s@+._-]*$/u.test(search)) throw fail(400, 'استخدم حروفًا وأرقامًا في البحث');
  const term = search.trim().replace(/_/g, '\\_');
  const params = new URLSearchParams({ merchant_id: `eq.${MERCHANT_ID}`, select: config.select, order: config.order, limit: '26', offset: String((Number(page) - 1) * 25) });
  const start=require('./salla-sync').windowDates().start;
  params.set(resource==='customers'?'crm_scope_at':resource==='orders'?'ordered_at':'abandoned_at',`gte.${start}`);
  // Double quoting preserves dots in emails; allowed input cannot close quotes.
  if (term) params.set('or', `(${config.search.map(column => `${column}.ilike.${JSON.stringify(`%${term}%`)}`).join(',')})`);
  const rows = await sb(`${config.table}?${params}`);
  if (!Array.isArray(rows)) throw fail(503, 'تعذر قراءة سجلات المتجر');
  return { records: rows.slice(0,25), page: Number(page), page_size: 25, has_more: rows.length > 25 };
}
module.exports = { resources, listRecords };
