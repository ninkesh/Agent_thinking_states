import { describe, expect, it } from 'vitest';
import { extractPlacePhotoName, glanceMediaUrl, resolveLoggedImageUrl } from './glanceMediaClient';

const PHOTO = 'places/ChIJexample/photos/AWexample';

describe('glanceMediaClient', () => {
  it('accepts a raw Google Places photo resource name', () => {
    expect(extractPlacePhotoName(PHOTO)).toBe(PHOTO);
    expect(glanceMediaUrl(PHOTO, 400)).toBe(
      `/api/glance-media?name=${encodeURIComponent(PHOTO)}&maxWidth=400`
    );
  });

  it('extracts a resource name from media URLs', () => {
    expect(extractPlacePhotoName(`https://places.googleapis.com/v1/${PHOTO}/media?maxWidthPx=600`)).toBe(PHOTO);
    expect(extractPlacePhotoName(`https://assistant.glance.com/v1/media/image?name=${encodeURIComponent(PHOTO)}&maxWidth=600`)).toBe(PHOTO);
  });

  it('leaves ordinary logged URLs unchanged and clamps width', () => {
    const legacy = 'https://cdn.example.com/photo.jpg';
    expect(resolveLoggedImageUrl(legacy, 600)).toBe(legacy);
    expect(glanceMediaUrl(PHOTO, 9999)).toContain('maxWidth=1600');
  });
});
