#!/usr/bin/env python3
"""Valida STL ASCII sin dependencias: cotas, aristas manifold y componentes."""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict, deque
from pathlib import Path


def parse_vertices(path: Path) -> list[tuple[float, float, float]]:
    vertices: list[tuple[float, float, float]] = []
    with path.open(encoding="ascii") as stream:
        for line in stream:
            fields = line.split()
            if len(fields) == 4 and fields[0] == "vertex":
                vertices.append(tuple(round(float(value), 5) for value in fields[1:]))
    if not vertices or len(vertices) % 3:
        raise ValueError(f"{path}: no contiene triángulos STL ASCII válidos")
    return vertices


def inspect(path: Path) -> bool:
    vertices = parse_vertices(path)
    triangles = [tuple(vertices[index:index + 3]) for index in range(0, len(vertices), 3)]
    edges: Counter[tuple[tuple[float, float, float], tuple[float, float, float]]] = Counter()
    adjacency: dict[tuple[float, float, float], set[tuple[float, float, float]]] = defaultdict(set)

    for triangle in triangles:
        for index in range(3):
            a, b = triangle[index], triangle[(index + 1) % 3]
            edge = tuple(sorted((a, b)))
            edges[edge] += 1
            adjacency[a].add(b)
            adjacency[b].add(a)

    remaining = set(adjacency)
    components = 0
    while remaining:
        components += 1
        queue = deque([remaining.pop()])
        while queue:
            for neighbour in adjacency[queue.popleft()]:
                if neighbour in remaining:
                    remaining.remove(neighbour)
                    queue.append(neighbour)

    xs, ys, zs = zip(*adjacency)
    bounds = (max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs))
    bad_edges = sum(count != 2 for count in edges.values())
    valid = bad_edges == 0
    print(
        f"{path.name}: {len(triangles)} triángulos · "
        f"{bounds[0]:.2f} × {bounds[1]:.2f} × {bounds[2]:.2f} mm · "
        f"{components} componente(s) · aristas inválidas: {bad_edges}"
    )
    return valid


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("paths", nargs="+", type=Path)
    args = parser.parse_args()
    return 0 if all(inspect(path) for path in args.paths) else 1


if __name__ == "__main__":
    raise SystemExit(main())
