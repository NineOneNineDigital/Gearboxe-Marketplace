import assert from 'node:assert/strict';
import test from 'node:test';
import { absoluteUrl, appOrigin, serializeJsonLd, soldListingMetadata, vehicleBrowseMetadata } from '../lib/seo.ts';

const originalUrl = process.env.NEXT_PUBLIC_APP_URL;
const originalMode = process.env.MARKETPLACE_ENV;
function withOrigin(url, mode, run) {
  process.env.NEXT_PUBLIC_APP_URL = url;
  process.env.MARKETPLACE_ENV = mode;
  try { run(); } finally {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = originalUrl;
    if (originalMode === undefined) delete process.env.MARKETPLACE_ENV;
    else process.env.MARKETPLACE_ENV = originalMode;
  }
}

test('canonicals use the configured origin and reject external paths', () => {
  withOrigin('https://market.example', 'production', () => {
    assert.equal(absoluteUrl('/vehicles/abc'), 'https://market.example/vehicles/abc');
    assert.throws(() => absoluteUrl('//other.example/vehicles'));
    assert.throws(() => absoluteUrl('https://other.example'));
  });
});

test('canonical configuration rejects credentials, path prefixes, and production HTTP', () => {
  for (const value of ['https://user:pass@market.example', 'https://market.example/path', 'https://market.example/?secret=x', 'http://localhost:3000']) {
    withOrigin(value, 'production', () => assert.throws(() => appOrigin()));
  }
  withOrigin('http://localhost:3000', 'development', () => assert.equal(appOrigin().origin, 'http://localhost:3000'));
});

test('filtered discovery shares its canonical and is excluded from indexing', () => {
  withOrigin('https://market.example', 'production', () => {
    const metadata = vehicleBrowseMetadata(true);
    assert.deepEqual(metadata.robots, { index: false, follow: true });
    assert.equal(metadata.alternates.canonical, 'https://market.example/vehicles');
    assert.equal(metadata.openGraph.url, 'https://market.example/vehicles');
    assert.equal(metadata.twitter.card, 'summary_large_image');
  });
});

test('listing structured data cannot terminate its script element', () => {
  const value = { name: '</script><script>alert(1)</script>' };
  const serialized = serializeJsonLd(value);
  assert.equal(serialized.includes('<'), false);
  assert.deepEqual(JSON.parse(serialized), value);
});

test('Sold metadata is noindex and contains no former image, VIN or price', () => {
  const metadata = soldListingMetadata({ year: 2020, make: 'Toyota', model: 'Camry' }, 'https://market.example/vehicles/sold');
  assert.deepEqual(metadata.robots, { index: false, follow: true });
  assert.equal(metadata.alternates.canonical, 'https://market.example/vehicles/sold');
  assert.equal(metadata.openGraph.images.length, 0);
  assert.equal(metadata.twitter.images.length, 0);
  assert.equal(JSON.stringify(metadata).includes('vin'), false);
  assert.equal(JSON.stringify(metadata).includes('price'), false);
});
