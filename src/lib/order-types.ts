import type { CartItem } from './cart-types';

export interface OrderCustomer {
  name: string;
  phone: string;
  email?: string;
  comment?: string;
}

export interface OrderItem {
  productId: string;
  title: string;
  price: number;
  quantity: number;
  variantId?: string;
}

export interface Order {
  customer: OrderCustomer;
  items: OrderItem[];
  total: number;
  currency: 'RUB';
  createdAt: string;
}

export interface OrderPayload {
  tenant: string;
  order: Order;
}

export function cartItemsToOrderItems(items: CartItem[]): OrderItem[] {
  return items.map((item) => ({
    productId: item.productId,
    title: item.title,
    price: item.price,
    quantity: item.quantity,
    variantId: item.variantId,
  }));
}

export function buildOrder(customer: OrderCustomer, items: CartItem[], total: number): Order {
  return {
    customer,
    items: cartItemsToOrderItems(items),
    total,
    currency: 'RUB',
    createdAt: new Date().toISOString(),
  };
}
