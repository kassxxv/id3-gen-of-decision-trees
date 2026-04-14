from node import Node
from id3 import information_gain, entropy


class ID3:
    def __init__(self):
        self.tree = None

    def fit(self, data, features: list, target: str):
        """Build the decision tree from training data. Returns self for chaining."""
        self.tree = self._build(data, features, target)
        return self

    def _build(self, data, features: list, target: str) -> Node:
        labels = data[target]

        # Base case: all examples share one label — no split needed
        if len(labels.unique()) == 1:
            leaf = Node()
            leaf.label = labels.iloc[0]
            leaf.entropy = 0.0
            leaf.samples = len(data)
            leaf.class_distribution = {str(k): int(v) for k, v in labels.value_counts().items()}
            return leaf

        # Base case: no features remain — fall back to majority vote
        if len(features) == 0:
            leaf = Node()
            leaf.label = labels.value_counts().idxmax()
            leaf.entropy = round(float(entropy(labels.tolist())), 4)
            leaf.samples = len(data)
            leaf.class_distribution = {str(k): int(v) for k, v in labels.value_counts().items()}
            return leaf

        # Greedy split: pick the feature that reduces entropy the most
        gains = {f: information_gain(data, f, target) for f in features}
        best_feature = max(gains, key=gains.get)

        node = Node()
        node.feature = best_feature
        node.entropy = round(float(entropy(labels.tolist())), 4)
        node.information_gain = round(float(gains[best_feature]), 4)
        node.samples = len(data)
        node.class_distribution = {str(k): int(v) for k, v in labels.value_counts().items()}

        remaining = [f for f in features if f != best_feature]

        for value in data[best_feature].unique():
            subset = data[data[best_feature] == value]
            node.children[value] = self._build(subset, remaining, target)

        return node


def build_tree(data, features: list, target: str, steps=None, counter=None, parent_id=None, edge_value=None) -> Node:
    """
    Recursively build an ID3 decision tree, optionally recording each step.

    Parameters
    ----------
    data       : training DataFrame (the subset at this recursion level)
    features   : remaining candidate features for splitting
    target     : name of the target column
    steps      : list to append step metadata to (enables frontend animation);
                 pass None to disable recording
    counter    : single-element list [int] — acts as a mutable integer so the
                 node ID counter is shared and incremented across recursive calls
                 (a plain int cannot be mutated in a nested scope in Python)
    parent_id  : node_id of the calling node, used to reconstruct the tree path
    edge_value : the feature value that routed execution to this subtree
    """
    if counter is None:
        counter = [0]  # list wrapper so nested calls share one mutable counter

    labels = data[target]
    node_id = counter[0]
    counter[0] += 1

    entropy_val = round(float(entropy(labels.tolist())), 4)
    samples = len(data)
    class_dist = labels.value_counts().to_dict()
    class_dist = {str(k): int(v) for k, v in class_dist.items()}

    # Base case: pure node — all labels are identical
    if len(labels.unique()) == 1:
        leaf = Node()
        leaf.label = labels.iloc[0]
        leaf.entropy = entropy_val
        leaf.samples = samples
        leaf.class_distribution = class_dist

        if steps is not None:
            steps.append({
                "step_number": len(steps) + 1,
                "node_id": node_id,
                "parent_id": parent_id,
                "edge_value": edge_value,
                "label": leaf.label,
                "entropy_before": entropy_val,
                "samples": samples,
                "class_distribution": class_dist,
                "is_leaf": True
            })
        return leaf

    # Base case: no features left — use majority class (impure leaf)
    if len(features) == 0:
        leaf = Node()
        leaf.label = labels.value_counts().idxmax()
        leaf.entropy = entropy_val
        leaf.samples = samples
        leaf.class_distribution = class_dist

        if steps is not None:
            steps.append({
                "step_number": len(steps) + 1,
                "node_id": node_id,
                "parent_id": parent_id,
                "edge_value": edge_value,
                "label": leaf.label,
                "entropy_before": entropy_val,
                "samples": samples,
                "class_distribution": class_dist,
                "is_leaf": True
            })
        return leaf

    # Greedy split: evaluate all remaining features and pick the highest IG
    gains = {}
    for feature in features:
        gains[feature] = information_gain(data, feature, target)

    best_feature = max(gains, key=gains.get)
    node = Node()
    node.feature = best_feature
    node.entropy = entropy_val
    node.information_gain = round(float(gains[best_feature]), 4)
    node.samples = samples
    node.class_distribution = class_dist

    if steps is not None:
        steps.append({
            "step_number": len(steps) + 1,
            "node_id": node_id,
            "parent_id": parent_id,
            "edge_value": edge_value,
            "feature_chosen": best_feature,
            "feature_candidates": {f: round(float(g), 4) for f, g in gains.items()},
            "entropy_before": entropy_val,
            "samples": samples,
            "class_distribution": class_dist,
            "is_leaf": False
        })

    remaining_features = [feature for feature in features if feature != best_feature]

    for value in data[best_feature].unique():
        subset = data[data[best_feature] == value]
        node.children[value] = build_tree(subset, remaining_features, target, steps, counter, node_id, str(value))

    return node
