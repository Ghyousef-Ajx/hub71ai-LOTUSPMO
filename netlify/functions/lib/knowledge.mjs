import data from '../data/knowledge-base.json' with { type: 'json' };

export const MATCH_THRESHOLD = 0.85;
export const categories = data.categories;
export const knowledgeBase = categories.flatMap(c => c.entries).sort((a, b) => a.id - b.id);
const normalize = value => value.normalize('NFKC').toLocaleLowerCase('en')
  .replace(/[’‘]/g, "'").replace(/\s+/g, ' ').replace(/[?.!]+$/, '').trim();
export function exactMatch(question) {
  return knowledgeBase.find(entry => normalize(entry.question) === normalize(question));
}
// Both portal URLs occur verbatim in the supplied document.
export const officialPortalLinks = ['https://www.tamm.abudhabi', 'https://smartservices.icp.gov.ae'];
export function matchedAnswer(entry, answer = entry.answer, language = 'en') {
  return {
    answer, answerLabel: answer === entry.answer ? entry.answerLabel : null,
    originalAnswer: entry.answer, links: entry.links, sources: entry.sources,
    entryId: entry.id, kind: 'knowledge_base', language, marker: null,
    // A PDF alone does not establish current portal verification.
    status: 'updates',
  };
}
export function resolveDecision(decision, language) {
  if (!decision || !(decision.entry_id === null || Number.isInteger(decision.entry_id)) ||
      !Number.isFinite(decision.confidence) || decision.confidence < 0 || decision.confidence > 1 ||
      typeof decision.general_answer !== 'string') throw new Error('Invalid matching response');
  const entry = knowledgeBase.find(e => e.id === decision.entry_id);
  if (decision.entry_id !== null && !entry) throw new Error('Unknown entry');
  if (entry && decision.confidence >= MATCH_THRESHOLD) return { entry };
  if (!decision.general_answer.trim()) throw new Error('Missing general answer');
  return {
    answer: decision.general_answer.trim(), links: officialPortalLinks, sources: [], entryId: null,
    kind: 'general', language, marker: 'check official portals', status: 'updates',
  };
}
export const matchingFormat = {
  type: 'json_schema', name: 'knowledge_match', strict: true,
  schema: {
    type: 'object', additionalProperties: false,
    properties: {
      entry_id: { type: ['integer', 'null'], enum: [...knowledgeBase.map(e => e.id), null] },
      confidence: { type: 'number' }, general_answer: { type: 'string' },
    }, required: ['entry_id', 'confidence', 'general_answer'],
  },
};
