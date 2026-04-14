"""
Each Node is either:
  - an internal decision node  (feature is set, children is populated), or
  - a leaf node                (label is set, children is empty).
"""


class Node:
    def __init__(self):
        self.feature: str | None = None          # splitting feature name (None for leaves)
        self.children: dict[str, "Node"] = {}    # edge value → child node
        self.label: str | None = None            # class label (None for internal nodes)
        self.entropy: float | None = None
        self.information_gain: float | None = None
        self.samples: int = 0
        self.class_distribution: dict[str, int] = {}

    def is_leaf(self) -> bool:
        return self.label is not None

    def __repr__(self) -> str:
        if self.is_leaf():
            return f'It is leaf {self.label}'
        return f'It is node {self.feature} that has child {list(self.children.keys())}'