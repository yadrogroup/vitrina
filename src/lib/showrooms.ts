import siteConfig from '../../site.config';
import type { Showroom, ShowroomMapDefaults } from './types/showroom';

export function getShowrooms(): Showroom[] {
  return siteConfig.showrooms ?? [];
}

export function getPrimaryShowroom(): Showroom | undefined {
  return getShowrooms()[0];
}

/** Центр карты по всем салонам города. */
export function getShowroomMapDefaults(showrooms: Showroom[]): ShowroomMapDefaults | undefined {
  if (showrooms.length === 0) return undefined;

  const lat = showrooms.reduce((sum, s) => sum + s.lat, 0) / showrooms.length;
  const lon = showrooms.reduce((sum, s) => sum + s.lon, 0) / showrooms.length;
  const zoom = showrooms.length === 1 ? 15 : 11;

  return {
    city: showrooms[0].city,
    lat,
    lon,
    zoom,
  };
}
