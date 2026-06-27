export interface Showroom {
  id: string;
  name: string;
  /** Подпись типа точки, напр. «Фирменный салон». */
  type: string;
  city: string;
  address: string;
  phone?: string;
  hours: string;
  twoGisUrl: string;
  twoGisOrgId: string;
  lat: number;
  lon: number;
}

export interface ShowroomMapDefaults {
  city: string;
  lat: number;
  lon: number;
  zoom: number;
}
