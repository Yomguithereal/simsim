import math
import networkx as nx
from collections import defaultdict


def compute_pmi(vectors):
    pmi = defaultdict(dict)
    sums = {}
    n_tot = 0

    for ingredient, vector in vectors.items():
        s = sum(vector.values())
        sums[ingredient] = s
        n_tot += s

    n_tot //= 2

    for A, vector in vectors.items():
        sumA = sums[A]

        for B, nAB in vector.items():

            if A > B:
                continue

            sumB = sums[B]

            s = math.log(nAB * n_tot / (sumA * sumB))

            if s > 1:
                pmi[A][B] = s
                pmi[B][A] = s

    return pmi


def compute_similarity_matrix(vectors):
    pmi = compute_pmi(vectors)
    matrix = defaultdict(dict)

    for A, vector in vectors.items():

        sumA = sum(pmi[A].values())

        if sumA <= 0:
            continue

        for B in vector:

            ks = set(pmi[A].keys()) & set(pmi[B].keys())

            d = sum(min(pmi[A][k], pmi[B][k]) for k in ks)

            s = d / sumA

            matrix[A][B] = s

    return matrix


def compute_similarity_graph(matrix, starting_treshold=0.1, learning_rate=0.01):
    g = nx.Graph()

    threshold = starting_treshold

    for A, vector in matrix.items():
        g.add_node(A)

        for B, similarity in vector.items():
            g.add_node(B)

            if A > B:
                continue

            if similarity >= threshold:
                g.add_edge(A, B, similarity=similarity)

    if g.size() == 0:
        return 0.0, g

    dropped_edges = []

    while True:

        # Attempting to reduce the threshold
        threshold += learning_rate

        for u, v, s in g.edges(data='similarity'):
            if s < threshold:
                dropped_edges.append((u, v, s))

        for u, v, _ in dropped_edges:
            g.remove_edge(u, v)

        components = sorted(nx.connected_components(g), key=len, reverse=True)

        if len(components) > 1 and len(components[1]) >= int(math.log(len(g))):

            # We found the tipping point, and need to reset the graph'state
            for u, v, s in dropped_edges:
                g.add_edge(u, v, similarity=s)

            break

        dropped_edges = []

    return threshold, g
