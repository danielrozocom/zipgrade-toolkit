import json

har_path = r"G:\Mi unidad\www.zipgrade.com.har"
with open(har_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

entries = data['log']['entries']
edit_entries = [e for e in entries if '/edit/' in e['request']['url']]

print(f"Found {len(edit_entries)} entries containing '/edit/':")
for i, entry in enumerate(edit_entries):
    req = entry['request']
    resp = entry['response']
    print(f"\nEntry {i+1}:")
    print(f"URL: {req['url']}")
    print(f"Method: {req['method']}")
    print(f"Status: {resp['status']}")
    
    post_data = req.get('postData', {})
    if post_data:
        print(f"Post Data: {post_data.get('text', '')[:1000]}")
