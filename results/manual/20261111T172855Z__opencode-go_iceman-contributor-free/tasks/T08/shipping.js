function shippingCents(subtotalCents, region) {
  if (region === 'local') return subtotalCents > 5000 ? 0 : 500;
  return subtotalCents > 10000 ? 0 : 1000;
}
module.exports = { shippingCents };
