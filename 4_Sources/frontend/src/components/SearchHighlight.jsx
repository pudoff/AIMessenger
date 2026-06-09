function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default function SearchHighlight({ text, terms = [] }) {
  const normalizedTerms = [...new Set(
    terms
      .map((term) => String(term || '').trim())
      .filter((term) => term.length > 1),
  )];

  if (!normalizedTerms.length) {
    return text;
  }

  const pattern = new RegExp(`(${normalizedTerms.map(escapeRegExp).join('|')})`, 'gi');
  return String(text || '').split(pattern).map((part, index) => {
    if (!part) return null;
    const isMatch = normalizedTerms.some((term) => term.toLowerCase() === part.toLowerCase());
    if (!isMatch) {
      return part;
    }
    return (
      <mark className="chat-semantic-search__highlight" key={`${part}-${index}`}>
        {part}
      </mark>
    );
  });
}
