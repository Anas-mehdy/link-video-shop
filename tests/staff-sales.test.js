const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTrackedUrl, attributionFromPayload, trackingCodeFromTerm, isValidOrder } = require('../lib/staff-sales');

test('buildTrackedUrl creates staff UTMs and preserves non-UTM query params', () => {
  const url = new URL(buildTrackedUrl('https://linkstore-sa.com/p/123?color=black&utm_source=old', 'instagram', 'abc123'));
  assert.equal(url.searchParams.get('color'), 'black');
  assert.equal(url.searchParams.get('utm_source'), 'instagram');
  assert.equal(url.searchParams.get('utm_medium'), 'customer_service');
  assert.equal(url.searchParams.get('utm_campaign'), 'assisted_sales');
  assert.equal(url.searchParams.get('utm_content'), 'ghofran');
  assert.equal(url.searchParams.get('utm_term'), 'cs_ghofran_abc123');
});

test('attributionFromPayload reads Salla source_details', () => {
  const attr = attributionFromPayload({ source_details:{ utm_source:'facebook', utm_medium:'customer_service', utm_campaign:'assisted_sales', utm_content:'ghofran', utm_term:'cs_ghofran_x1' } });
  assert.deepEqual(attr, { employee:'ghofran', platform:'facebook', tracking_code:'x1', utm_term:'cs_ghofran_x1' });
});

test('tracking and order validity helpers work', () => {
  assert.equal(trackingCodeFromTerm('cs_ghofran_zz'), 'zz');
  assert.equal(isValidOrder({status_slug:'under_review'}), true);
  assert.equal(isValidOrder({status_slug:'cancelled'}), false);
});
