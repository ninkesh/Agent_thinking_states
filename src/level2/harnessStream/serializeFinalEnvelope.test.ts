import { describe, expect, it } from 'vitest';
import { partitionEnvelope } from '../classification/entityRole';
import { parseResponseEnvelope } from '../normalization/responseEnvelope';
import { serializeFinalEnvelope } from './serializeFinalEnvelope';

describe('serializeFinalEnvelope — lossless harness fields', () => {
  it('uses a structured block summary verbatim', () => {
    const output = serializeFinalEnvelope([{
      type: 'card_template',
      summary: 'Exact logged summary.',
      sections: [],
      conclusion: 'Exact logged conclusion.',
    }]);
    const envelope = parseResponseEnvelope(output);
    expect(envelope.summary).toBe('Exact logged summary.');
    expect(envelope.prose).toEqual(['Exact logged conclusion.']);
  });

  it('preserves exact CTA/phone labels and does not create absent ones', () => {
    const output = serializeFinalEnvelope([{
      type: 'place_card',
      summary: 'Places.',
      sections: [{
        cards: [
          {
            title: 'With action',
            rating: '4.9★ (149 Reviews)',
            cta: { label: 'Open on Maps', url: 'https://maps.google.com/?cid=123' },
            phone: { num: '01234', tel: 'tel:01234' },
          },
          { title: 'Without action', rating: '4.5★' },
        ],
      }],
    }]);
    const { entities } = partitionEnvelope(parseResponseEnvelope(output));
    expect(entities[0].attributes).toMatchObject({
      ctaUrl: 'https://maps.google.com/?cid=123',
      ctaLabel: 'Open on Maps',
      phone: '01234',
      phoneTel: 'tel:01234',
      ratingText: '4.9★ (149 Reviews)',
    });
    expect(entities[1].attributes).not.toHaveProperty('ctaUrl');
    expect(entities[1].attributes).not.toHaveProperty('ctaLabel');
  });

  it('retains product fields already present in the final block', () => {
    const output = serializeFinalEnvelope([{
      type: 'product_picks',
      products: [{
        product_id: 'p1',
        title: 'Logged backpack',
        brand: 'Logged brand',
        price: 562,
        original_price: 700,
        currency: 'INR',
        deeplink_url: 'https://shop.example/p1',
        in_stock: true,
        category: ['Accessories/Backpack'],
        gender: 'UNISEX',
        vton_enabled: true,
      }],
    }]);
    const { entities } = partitionEnvelope(parseResponseEnvelope(output));
    expect(entities[0].attributes).toMatchObject({
      ctaUrl: 'https://shop.example/p1',
      brand: 'Logged brand',
      originalPrice: 700,
      currency: 'INR',
      inStock: true,
      categories: ['Accessories/Backpack'],
      gender: 'UNISEX',
      vtonEnabled: true,
    });
  });
});
