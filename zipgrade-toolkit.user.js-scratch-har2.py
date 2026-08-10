import json

har_path = r"G:\Mi unidad\www.zipgrade.com.har"
with open(har_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

entries = data['log']['entries']
all_page_entries = [e for e in entries if '/all/' in e['request']['url']]

print(f"Found {len(all_page_entries)} entries containing '/all/':")
for i, entry in enumerate(all_page_entries):
    req = entry['request']
    resp = entry['response']
    print(f"\nEntry {i+1}:")
    print(f"URL: {req['url']}")
    print(f"Method: {req['method']}")
    print(f"Status: {resp['status']}")
    
    content = resp.get('content', {})
    text = content.get('text', '')
    if text:
        # Search for form or modal containing copyQuiz or copy
        print("Searching for copy form...")
        import re
        matches = re.findall(r'<form[^>]*action="[^"]*copyQuiz[^"]*"[^>]*>.*?</form>', text, re.DOTALL | re.IGNORECASE)
        for m_idx, match in enumerate(matches):
            print(f"Match {m_idx+1}:")
            print(match[:2000])
        
        # Also print the quiz date displayed on this page!
        print("\nSearching for quiz date display...")
        # Usually it shows Date: or something similar
        date_matches = re.findall(r'(?:date|fecha).*?\d{4}-\d{2}-\d{2}', text, re.IGNORECASE)
        print("Date matches:", date_matches)
        
        # Look for table or label displaying date
        date_labels = re.findall(r'<label[^>]*>Date:</label>\s*<div[^>]*>(.*?)</div>', text, re.IGNORECASE | re.DOTALL)
        if date_labels:
            print("Date labels:", date_labels)
        else:
            # Maybe a simple td or list item
            more_date = re.findall(r'<td>Date:</td>\s*<td>(.*?)</td>', text, re.IGNORECASE | re.DOTALL)
            print("More date td matches:", more_date)
