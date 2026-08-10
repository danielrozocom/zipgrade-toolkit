import json
import re

har_path = r"G:\Mi unidad\www.zipgrade.com.har"
with open(har_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

entries = data['log']['entries']
all_page_entries = [e for e in entries if '/all/' in e['request']['url']]
html = all_page_entries[0]['response']['content'].get('text', '')

# Search for any date-like string or pattern like YYYY-MM-DD or DD/MM/YYYY or month abbreviations
print("Searching for date display strings:")
# Search for lines containing things like "Date:" or "Fecha:" or containing "2026-"
lines = html.split('\n')
for i, line in enumerate(lines):
    if 'date' in line.lower() or '2026' in line:
        print(f"Line {i+1}: {line.strip()[:200]}")
