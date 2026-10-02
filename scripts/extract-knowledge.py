"""Extract the supplied fact sheet without rewriting answers or source wording.

Requires Poppler's pdftotext. Run from any directory; output is deterministic.
Only layout indentation, page breaks, and URL line wrapping are removed.
"""
import json
import re
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = root / 'netlify/functions/data/Just-Landed-100-questions.pdf'
output = root / 'netlify/functions/data/knowledge-base.json'
text = subprocess.check_output(['pdftotext', '-layout', str(source), '-'], text=True)
text = text.replace('\f', '')
text = text[text.index('Before arrival — fact sheet (Q1–Q10)'):]
text = re.sub(r'(?m)^.*(?:FACT SHEET WITH SOURCES|Before arrival — fact sheet).*\n', '', text)
starts = list(re.finditer(r'(?m)^(\d{1,3})\. (.+)\n(?=Answer(?: \([^\n]*\))?:)', text))
assert [int(m[1]) for m in starts] == list(range(1, 101)), 'Expected all 100 entries in order'
entries = []
for i, start in enumerate(starts):
    block = text[start.end():starts[i + 1].start() if i + 1 < len(starts) else len(text)].strip()
    answer_label = re.match(r'Answer(?: \([^\n]*\))?: ', block)
    assert answer_label
    source_heading = re.search(r'(?m)^(?:Key sources \(links\)|Sources):\s*\n', block)
    assert source_heading, start[1]
    # Keep the answer's wording, punctuation and line breaks; strip only indentation.
    answer = '\n'.join(line.strip() for line in block[answer_label.end():source_heading.start()].strip().splitlines())
    source_text = block[source_heading.end():].strip()
    source_items = re.split(r'(?m)^\s*•\s*', source_text)
    assert not source_items[0].strip()
    sources = []
    links = []
    for item in source_items[1:]:
        item = '\n'.join(line.strip() for line in item.strip().splitlines())
        # The PDF wraps URLs after a slash or hyphen; preserve those characters.
        unwrapped = re.sub(r'(https?://[^\s]*[-/])\n(?=[a-zA-Z0-9])', r'\1', item)
        urls = re.findall(r'https?://[^\s]+', unwrapped)
        sources.append({'text': item, 'links': urls})
        links.extend(urls)
    assert links, start[1]
    entries.append({'id': int(start[1]), 'question': start[2], 'answerLabel': answer_label[0].strip(), 'answer': answer, 'sources': sources, 'links': links})
category_ids = {
    'Residency & Documents': [1, 2, 3, 4, 11, 12, 15, 16, 17, 19, 20, 48],
    'Housing': [9, *range(21, 29)],
    'Schools': [*range(29, 36)],
    'Healthcare': [5, *range(36, 41)],
    'Daily Life': [7, 8, 10, 14, *range(41, 48), 50, *range(67, 75)],
    'Family': [18, 49, *range(75, 83)],
    'Money & Banking': [6, 13, *range(51, 59)],
    'Work & Legal': [*range(59, 67)],
    'Safety': [*range(83, 89)],
    'Long-Term': [*range(89, 101)],
}
assert sorted(i for ids in category_ids.values() for i in ids) == list(range(1, 101))
by_id = {entry['id']: entry for entry in entries}
categories = [{'name': name, 'entries': [by_id[i] for i in ids]} for name, ids in category_ids.items()]
output.write_text(json.dumps({'categories': categories}, ensure_ascii=False, indent=2) + '\n')
topics = [{'name': c['name'], 'questions': [{'id': e['id'], 'question': e['question']} for e in c['entries']]} for c in categories]
(root / 'public/topics.json').write_text(json.dumps(topics, ensure_ascii=False, indent=2) + '\n')
print(f'Extracted {len(entries)} entries and {sum(len(e["links"]) for e in entries)} links')
