class Node:
    def __init(self):
        self.feature: str | None = None # name of the feature
        self.children: dict[str, Node] = {}
        self.label: str | None = None

    def is_leaf(self) -> bool:
        return self.label is not None

    def __repr__(self) -> str:
        if self.is_leaf():
            return f'It is leaf {self.label}'
        return f'It is node {self.feature} that has child {list(self.children.keys())}'