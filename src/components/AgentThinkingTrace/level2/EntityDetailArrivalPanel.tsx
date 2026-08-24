import type { EntityFieldArrival, EntityFieldArrivalKey } from '../../../level2/types/pass';

const FIELD_LABEL: Record<EntityFieldArrivalKey, string> = {
  hours: 'Opening hours',
  review: 'Guest review',
  description: 'Description',
  rating: 'Rating',
  review_count: 'Review count',
  price: 'Price',
  location: 'Location',
  distance: 'Distance',
  travel_time: 'Travel time',
  open_status: 'Availability',
  phone: 'Phone',
  website: 'Website',
  brand: 'Brand',
  stock_status: 'Availability',
  original_price: 'Original price',
  categories: 'Categories',
  gender: 'For',
  virtual_try_on: 'Virtual try-on',
};

/** The result half of a Search -> Details pair. It is intentionally separate
 * from the entity tile: the tile is stable identity and prior knowledge; this
 * panel is the evidence that just arrived. */
export default function EntityDetailArrivalPanel({ arrivals }: { arrivals: EntityFieldArrival[] }) {
  if (!arrivals.length) return null;
  const hasChangedValue = arrivals.some((arrival) => arrival.change === 'changed');

  return (
    <aside className="att-l2-detail-arrival" role="status" aria-live="polite">
      <div className="att-l2-detail-arrival-head">
        <span className="att-l2-detail-arrival-signal" aria-hidden />
        <div>
          <div className="att-l2-detail-arrival-eyebrow">Just received</div>
          <div className="att-l2-detail-arrival-title">
            {hasChangedValue ? 'Updated details' : 'New details'}
          </div>
        </div>
      </div>

      <div className="att-l2-detail-arrival-list">
        {arrivals.map((arrival, index) => (
          <div
            className={`att-l2-detail-arrival-row att-l2-detail-arrival-row--${arrival.field}`}
            key={`${arrival.field}-${index}`}
            style={{ '--di': index } as React.CSSProperties}
          >
            <div className="att-l2-detail-arrival-label">{FIELD_LABEL[arrival.field]}</div>
            <div className="att-l2-detail-arrival-value">{arrival.value}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}
