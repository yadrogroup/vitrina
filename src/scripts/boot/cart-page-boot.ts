import { readPageData } from '../../lib/page-data';
import { initCartPage } from '../cart-ui';
import { initOrderForm, type OrderClientConfig } from '../order-submit';

export function bootCartPage(): void {
  const orderConfig = readPageData<OrderClientConfig>('[data-page-data="cart-page"]');
  initCartPage();
  initOrderForm(orderConfig);
}
