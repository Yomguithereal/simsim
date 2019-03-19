import json
import networkx as nx
import community as louvain
from collections import defaultdict, Counter
from tqdm import tqdm
from utils import compute_similarity_matrix, compute_similarity_graph

# Parameters
RECIPES_PATH = './det_ingrs_recipes.json'
OUTPUT_PATH = './data.json'
FREQUENCY_THRESHOLD = 10

print('Reading JSON file...')
with open(RECIPES_PATH, 'r') as f:
    RECIPES = json.load(f)

print('Processing frequencies...')
FREQUENCIES = Counter()

for recipe in RECIPES:
    ingredients = recipe['ingredients']

    for ingredient in ingredients:
        FREQUENCIES[ingredient] += 1

print('Processing vectors...')
VECTORS = defaultdict(Counter)

for recipe in RECIPES:
    ingredients = recipe['ingredients']

    for i in range(len(ingredients)):
        A = ingredients[i]

        if FREQUENCIES[A] < FREQUENCY_THRESHOLD:
            continue

        for j in range(i + 1, len(ingredients)):
            B = ingredients[j]

            if FREQUENCIES[B] < FREQUENCY_THRESHOLD:
                continue

            VECTORS[A][B] += 1
            VECTORS[B][A] += 1

print('Processing similarity matrix...')
MATRIX = compute_similarity_matrix(VECTORS)

print('Processing similarity graph...')
THETA, GRAPH = compute_similarity_graph(MATRIX)
principal_component = max(nx.connected_components(GRAPH), key=len)
GRAPH = GRAPH.subgraph(principal_component)

dump = {
    'macro': {
        'threshold': THETA,
        'nodes': list(GRAPH.nodes),
        'edges': list(GRAPH.edges(data='similarity'))
    },
    'micro': []
}

print('Processing communities...')
COMMUNITIES = louvain.best_partition(GRAPH)
COMMUNITY_SETS = defaultdict(set)

for node, community in COMMUNITIES.items():
    COMMUNITY_SETS[community].add(node)

for community in COMMUNITY_SETS.values():
    vectors = {}

    for ingredient in community:
        vectors[ingredient] = {k: v for k, v in VECTORS[ingredient].items() if k in community}

    matrix = compute_similarity_matrix(vectors)
    th, g = compute_similarity_graph(matrix)

    if not g.size():
        continue

    dump['micro'].append({
        'threshold': th,
        'nodes': list(g.nodes),
        'edges': list(g.edges(data='similarity'))
    })

with open(OUTPUT_PATH, 'w') as f:
    json.dump(dump, f, ensure_ascii=False)
