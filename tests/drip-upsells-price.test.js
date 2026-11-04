const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {parseHTML} = require('linkedom');

const script = fs.readFileSync(require.resolve('../public/drip-upsells.js'), 'utf8');
const config = require('../public/drip-upsells-config.json');
const caseId = 284157041;
const plateId = 1936666261;
const lensId = 965494067;
const holderId = 387390654;

async function mount(getDetails) {
  const {document, Event} = parseHTML(`<html><head></head><body>
    <form class="product-form">
      <input name="quantity" value="1">
      <div><salla-add-product-button product-id="${caseId}"></salla-add-product-button></div>
    </form></body></html>`);
  const window = {salla: {product: {getDetails}, cart: {addItem() {}, event: {onItemAdded() {}}}}};
  const fetch = async () => ({ok: true, json: async () => structuredClone(config)});
  vm.runInNewContext(script, {window, document, location: {pathname: '/p' + caseId}, fetch});
  await new Promise(resolve => setImmediate(resolve));

  function selectProduct(id) {
    const input = document.querySelector('#ld-pick-' + id);
    input.checked = true;
    input.dispatchEvent(new Event('change', {bubbles: true}));
    return input.closest('.ld-row');
  }
  return {
    document, Event, selectProduct,
    total: () => document.querySelector('.ld-summary').textContent,
    holder: () => document.querySelector('a[href$="/p' + holderId + '"]').nextElementSibling.textContent
  };
}

test('verified catalog prices remain usable if the storefront lookup fails', async () => {
  const widget = await mount(async () => { throw new Error('Unavailable'); });
  assert.equal(widget.total(), 'الإجمالي: 69 ر.س');
  assert.equal(widget.holder(), '69 ر.س');
  const row = widget.selectProduct(plateId);
  assert.equal(widget.total(), 'الإجمالي: 128 ر.س');
  row.querySelector('button[aria-label^="زيادة"]').click();
  assert.equal(widget.total(), 'الإجمالي: 187 ر.س');
  const mainQuantity = widget.document.querySelector('input[name="quantity"]');
  mainQuantity.value = '2';
  mainQuantity.dispatchEvent(new widget.Event('input', {bubbles: true}));
  assert.equal(widget.total(), 'الإجمالي: 256 ر.س');
});

test('live product, accessory and selected lens prices replace catalog prices', async () => {
  const choice = config.products[caseId].items.find(p => p.id === lensId).choices[0];
  const lensValueId = choice.values[0].id;
  const live = {
    [caseId]: {price: 90, is_on_sale: true, sale_price: 79},
    [holderId]: {price: {amount: 75}},
    [lensId]: {price: 89, options: [{id: choice.id, details: [{id: lensValueId, additional_price: 5}]}]}
  };
  const widget = await mount(async id => ({data: {product: {id, ...live[id]}}}));
  assert.equal(widget.total(), 'الإجمالي: 79 ر.س');
  assert.equal(widget.holder(), '75 ر.س');
  const row = widget.selectProduct(lensId);
  assert.equal(widget.total(), 'الإجمالي: 168 ر.س');
  const select = row.querySelector('select');
  select.querySelector('option[value="' + lensValueId + '"]').selected = true;
  select.dispatchEvent(new widget.Event('change', {bubbles: true}));
  assert.equal(widget.total(), 'الإجمالي: 173 ر.س');
});
