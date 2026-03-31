class Node:
    def __init__(self):
        self.feature: str | None = None # name of the feature
        self.children: dict[str, Node] = {}
        self.label: str | None = None
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