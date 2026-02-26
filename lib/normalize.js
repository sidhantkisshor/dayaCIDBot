// DayaCID Bot — Unicode Normalization & Entity Parsing

// Strip zero-width characters and normalize confusable Unicode
export function normalizeText(text) {
  if (!text) return '';
  return text
    // Strip zero-width chars
    .replace(/[\u200B\u200C\u200D\uFEFF\u00AD\u2060\u2061\u2062\u2063\u2064]/g, '')
    // Cyrillic → Latin confusables (commonly used to bypass keyword filters)
    .replace(/\u0430/g, 'a')   // а → a
    .replace(/\u0435/g, 'e')   // е → e
    .replace(/\u043E/g, 'o')   // о → o
    .replace(/\u0441/g, 'c')   // с → c
    .replace(/\u0440/g, 'p')   // р → p
    .replace(/\u0456/g, 'i')   // і → i
    .replace(/\u0455/g, 's')   // ѕ → s
    .replace(/\u04BB/g, 'h')   // һ → h
    .replace(/\u0443/g, 'y')   // у → y
    .replace(/\u0445/g, 'x')   // х → x
    // Normalize whitespace (but preserve newlines for structure)
    .replace(/[^\S\n]+/g, ' ')
    .trim();
}

// Check if text contains zero-width obfuscation characters
export function hasObfuscation(text) {
  if (!text) return false;
  return /[\u200B\u200C\u200D\uFEFF\u00AD\u2060]/.test(text);
}

// Extract all URLs from message entities (more reliable than regex)
export function extractHiddenUrls(message) {
  const urls = [];
  const entities = message.entities || [];
  const captionEntities = message.caption_entities || [];
  const text = message.text || '';
  const caption = message.caption || '';

  for (const entity of entities) {
    if (entity.type === 'text_link') {
      urls.push({ url: entity.url, hidden: true });
    } else if (entity.type === 'url') {
      urls.push({ url: text.substring(entity.offset, entity.offset + entity.length), hidden: false });
    }
  }

  for (const entity of captionEntities) {
    if (entity.type === 'text_link') {
      urls.push({ url: entity.url, hidden: true });
    } else if (entity.type === 'url') {
      urls.push({ url: caption.substring(entity.offset, entity.offset + entity.length), hidden: false });
    }
  }

  return urls;
}

// Extract entity type counts for scoring
export function extractEntityInfo(message) {
  const entities = [...(message.entities || []), ...(message.caption_entities || [])];
  const info = {
    urlCount: 0,
    hiddenLinkCount: 0,
    phoneCount: 0,
    mentionCount: 0,
    blockquoteCount: 0,
    customEmojiCount: 0,
  };

  for (const entity of entities) {
    switch (entity.type) {
      case 'url': info.urlCount++; break;
      case 'text_link': info.hiddenLinkCount++; break;
      case 'phone_number': info.phoneCount++; break;
      case 'mention': info.mentionCount++; break;
      case 'blockquote':
      case 'expandable_blockquote': info.blockquoteCount++; break;
      case 'custom_emoji': info.customEmojiCount++; break;
    }
  }

  return info;
}
