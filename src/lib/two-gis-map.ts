export interface TwoGisWidgetOptions {
  city: string;
  lat: number;
  lon: number;
  zoom?: number;
  /** Обязателен для type=firmsonmap — без org виджет падает с ошибкой. */
  orgId: string;
}

/** Карточка фирмы внутри iframe 2ГИС занимает левую часть карты. */
export const TWO_GIS_FIRM_CARD_PX = 320;

export function parseTwoGisOrgId(url?: string): string | undefined {
  if (!url) return undefined;
  const match = url.match(/\/firm\/(\d+)/);
  return match?.[1];
}

export function buildTwoGisWidgetUrl(options: TwoGisWidgetOptions): string {
  const payload = {
    pos: {
      lat: options.lat,
      lon: options.lon,
      zoom: options.zoom ?? 11,
    },
    opt: { city: options.city },
    org: options.orgId,
  };

  return `https://widgets.2gis.com/widget?options=${encodeURIComponent(JSON.stringify(payload))}&type=firmsonmap`;
}

/**
 * Сдвигает центр карты вправо, чтобы маркер был по центру видимой области
 * (справа от карточки фирмы 2ГИС и/или нашей панели).
 */
export function computeMapCenterForVisibleArea(
  lat: number,
  lon: number,
  zoom: number,
  mapWidthPx: number,
  leftPaddingPx: number,
): { lat: number; lon: number } {
  if (leftPaddingPx <= 0 || mapWidthPx <= leftPaddingPx) {
    return { lat, lon };
  }

  const pixelOffset = leftPaddingPx / 2;
  const latRad = (lat * Math.PI) / 180;
  const degreesPerPixel = 360 / (256 * 2 ** zoom * Math.cos(latRad));

  return {
    lat,
    lon: lon - degreesPerPixel * pixelOffset,
  };
}

export function buildShowroomWidgetUrl(params: {
  city: string;
  lat: number;
  lon: number;
  zoom: number;
  orgId: string;
  mapWidthPx?: number;
  /** Дополнительный отступ слева (например, если панель перекрывает карту). */
  extraLeftPaddingPx?: number;
}): string {
  const leftPadding = TWO_GIS_FIRM_CARD_PX + (params.extraLeftPaddingPx ?? 0);
  const center = computeMapCenterForVisibleArea(
    params.lat,
    params.lon,
    params.zoom,
    params.mapWidthPx ?? 0,
    leftPadding,
  );

  return buildTwoGisWidgetUrl({
    city: params.city,
    lat: center.lat,
    lon: center.lon,
    zoom: params.zoom,
    orgId: params.orgId,
  });
}
