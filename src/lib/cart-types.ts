export interface CartItem {
  productId: string;
  variantId?: string;
  slug: string;
  title: string;
  price: number;
  image?: string;
  quantity: number;
}

export interface CartState {
  items: CartItem[];
}

export const CART_STORAGE_KEY = 'vitrina-cart';
