const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTrackedUrl, attributionFromPayload, trackingCodeFromTerm, isValidOrder } = require('../lib/staff-sales');

test('buildTrackedUrl generates neutral service UTMs, keeps non-UTM params, and removes employee name', () => {
  for (const platform of ['instagram', 'facebook', 'tiktok']) {
    const url = new URL(buildTrackedUrl('https://linkstore-sa.com/p/123?color=black&utm_source=old&utm_content=ghofran', platform, 'abc123'));
    assert.equal(url.searchParams.get('color'), 'black');
    assert.equal(url.searchParams.get('utm_source'), platform + '_cstmrservice');
    assert.equal(url.searchParams.get('utm_medium'), 'customer_service');
    assert.equal(url.searchParams.get('utm_campaign'), 'assisted_sales');
    assert.equal(url.searchParams.get('utm_content'), 'customer_service');
    assert.equal(url.searchParams.get('utm_term'), 'cs_customer_service_abc123');
    assert.equal(url.toString().includes('ghofran'), false);
  }
});

test('attributionFromPayload reads new service source and normalizes platform for reporting', () => {
  const attr = attributionFromPayload({ source_details: {
    utm_source:'facebook_cstmrservice', utm_medium:'customer_service',
    utm_campaign:'assisted_sales', utm_content:'customer_service',
    utm_term:'cs_customer_service_x1'
  } });
  assert.deepEqual(attr, { employee:'ghofran', platform:'facebook', tracking_code:'x1', utm_term:'cs_customer_service_x1' });
});

test('legacy staff links remain attributed to the same employee and channel', () => {
  const attr = attributionFromPayload({ source_details: {
    utm_source:'tiktok', utm_medium:'customer_service',
    utm_campaign:'assisted_sales', utm_content:'ghofran',
    utm_term:'cs_ghofran_old1'
  } });
  assert.deepEqual(attr, { employee:'ghofran', platform:'tiktok', tracking_code:'old1', utm_term:'cs_ghofran_old1' });
});

test('tracking and order validity helpers work', () => {
  assert.equal(trackingCodeFromTerm('cs_customer_service_zz'), 'zz');
  assert.equal(trackingCodeFromTerm('cs_ghofran_zz'), 'zz');
  assert.equal(attributionFromPayload({source_details: {utm_source:'tiktok', utm_medium:'customer_service', utm_campaign:'assisted_sales', utm_content:'customer_service'}}), null);
  assert.equal(isValidOrder({status_slug:'under_review'}), true);
  assert.equal(isValidOrder({status_slug:'cancelled'}), false);
});
