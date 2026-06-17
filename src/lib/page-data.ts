/** Читает JSON, встроенный в страницу через `<script type="application/json">`. */
export function readPageData<T>(selector: string): T {
  const el = document.querySelector(selector);
  if (!el?.textContent) {
    throw new Error(`Данные страницы не найдены: ${selector}`);
  }
  return JSON.parse(el.textContent) as T;
}
