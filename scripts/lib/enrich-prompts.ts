export const DESCRIPTION_PROMPT = `Ты — копирайтер мебельного магазина. Перепиши данные о товаре в продающее,
но честное описание на русском. 2–3 коротких абзаца, без воды и кликбейта,
упомяни материал, размеры и сценарий использования, если они есть в данных.
Не выдумывай характеристики, которых нет.

Формат ответа: только plain text. Без markdown (без #, **, списков).
Без заголовков вроде «Продающий текст» и «Описание товара».
Абзацы разделяй пустой строкой.

Товар: {title}
Сырое описание: {description}
Характеристики: {attributes}`;

export const SEO_PROMPT = `Сгенерируй SEO для карточки товара. Верни строго JSON без пояснений:
{"title": "...", "description": "..."}
title ≤ 60 символов, description ≤ 155 символов, на русском, с типом товара
и ключевой характеристикой, без спама и КАПСА.

Товар: {title}. Характеристики: {attributes}.`;

export function fillPrompt(
  template: string,
  values: { title: string; description: string; attributes: string },
): string {
  return template
    .replace('{title}', values.title)
    .replace('{description}', values.description)
    .replace('{attributes}', values.attributes);
}

export function parseSeoResponse(raw: string): { title: string; description: string } | null {
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return null;

  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as {
      title?: string;
      description?: string;
    };

    if (!parsed.title?.trim() || !parsed.description?.trim()) return null;

    return {
      title: parsed.title.trim().slice(0, 60),
      description: parsed.description.trim().slice(0, 155),
    };
  } catch {
    return null;
  }
}
