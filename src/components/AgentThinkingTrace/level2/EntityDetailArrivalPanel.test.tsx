import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import EntityDetailArrivalPanel from './EntityDetailArrivalPanel';

describe('EntityDetailArrivalPanel', () => {
  it('labels and renders the exact newly arrived Q07 values in a separate status panel', () => {
    const html = renderToStaticMarkup(
      <EntityDetailArrivalPanel
        arrivals={[
          {
            field: 'hours',
            value: 'Friday: 11:00 AM – 11:30 PM',
            change: 'added',
            multiline: true,
          },
          {
            field: 'review',
            value: '5★ · RNR is my go to for donne biryani, great vegetarian options and lovely ambience.',
            change: 'added',
            multiline: true,
          },
        ]}
      />
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('New details');
    expect(html).toContain('Opening hours');
    expect(html).toContain('Friday: 11:00 AM – 11:30 PM');
    expect(html).toContain('Guest review');
    expect(html).toContain('RNR is my go to for donne biryani');
  });

  it('distinguishes a changed value from a newly added one', () => {
    const html = renderToStaticMarkup(
      <EntityDetailArrivalPanel arrivals={[{ field: 'price', value: '₹500', change: 'changed' }]} />
    );
    expect(html).toContain('Updated details');
  });
});
