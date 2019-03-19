import json

with open('./det_ingrs.json') as f:
    data = json.load(f)

recipes = [{'id': r['id'], 'ingredients': [i for v, i in zip(r['valid'], (i['text'] for i in r['ingredients'])) if v]} for r in data]

print(json.dumps(recipes))
