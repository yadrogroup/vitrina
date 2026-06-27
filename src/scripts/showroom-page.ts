import { buildShowroomWidgetUrl } from '../lib/two-gis-map';

const MOBILE_MQ = '(max-width: 768px)';

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function getMapWidth(): number {
  const map = document.querySelector<HTMLIFrameElement>('[data-showroom-map]');
  return map?.clientWidth ?? 0;
}

export function initShowroomPage(): void {
  const root = document.querySelector<HTMLElement>('[data-showroom-page]');
  const map = document.querySelector<HTMLIFrameElement>('[data-showroom-map]');
  const search = document.querySelector<HTMLInputElement>('[data-showroom-search]');
  const cards = [...document.querySelectorAll<HTMLElement>('[data-showroom-card]')];
  const typeButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-showroom-type]')];
  const viewButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-showroom-view]')];

  if (!root || !map || cards.length === 0) return;

  let activeType = 'all';
  let activeCard: HTMLElement | null = null;

  const setMapForCard = (card: HTMLElement): void => {
    const city = card.dataset.city;
    const lat = Number(card.dataset.lat);
    const lon = Number(card.dataset.lon);
    const orgId = card.dataset.orgId;
    const zoom = Number(card.dataset.zoom ?? 16);

    if (!city || !orgId || !Number.isFinite(lat) || !Number.isFinite(lon)) return;

    map.src = buildShowroomWidgetUrl({
      city,
      lat,
      lon,
      zoom,
      orgId,
      mapWidthPx: getMapWidth(),
    });

    activeCard = card;

    cards.forEach((item) => {
      const active = item === card;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-current', active ? 'true' : 'false');
    });
  };

  const recenterActiveCard = (): void => {
    if (activeCard) setMapForCard(activeCard);
  };

  const applyFilters = (): void => {
    const query = normalize(search?.value ?? '');

    cards.forEach((card) => {
      const haystack = normalize(
        [card.dataset.name, card.dataset.address, card.dataset.type].filter(Boolean).join(' '),
      );
      const typeMatch = activeType === 'all' || card.dataset.type === activeType;
      const queryMatch = !query || haystack.includes(query);
      card.hidden = !(typeMatch && queryMatch);
    });
  };

  cards.forEach((card) => {
    card.addEventListener('click', () => setMapForCard(card));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setMapForCard(card);
      }
    });
    card.querySelector('[data-showroom-external]')?.addEventListener('click', (event) => {
      event.stopPropagation();
    });
  });

  search?.addEventListener('input', applyFilters);

  typeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      activeType = button.dataset.showroomType ?? 'all';
      typeButtons.forEach((item) => {
        item.classList.toggle('is-active', item === button);
        item.setAttribute('aria-pressed', String(item === button));
      });
      applyFilters();
    });
  });

  viewButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const view = button.dataset.showroomView ?? 'map';
      root.dataset.view = view;
      viewButtons.forEach((item) => {
        item.classList.toggle('is-active', item === button);
        item.setAttribute('aria-pressed', String(item === button));
      });
      if (view === 'map') recenterActiveCard();
    });
  });

  window.addEventListener('resize', recenterActiveCard);

  applyFilters();
}
