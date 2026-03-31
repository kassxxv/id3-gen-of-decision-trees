from node import Node
from id3 import information_gain, entropy


class ID3:
    def __init__(self):
        self.tree = None

    def fit(self, data, features: list, target: str):
        self.tree = self._build(data, features, target)
        return self

    def _build(self, data, features: list, target: str) -> Node:
        labels = data[target]

        # All examples have the same label → pure leaf
        if len(labels.unique()) == 1:
            leaf = Node()
            leaf.label = labels.iloc[0]
            leaf.entropy = 0.0
            leaf.samples = len(data)
            leaf.class_distribution = {str(k): int(v) for k, v in labels.value_counts().items()}
            return leaf

        # No features left → majority vote leaf
        if len(features) == 0:
            leaf = Node()
            leaf.label = labels.value_counts().idxmax()
            leaf.entropy = round(float(entropy(labels.tolist())), 4)
            leaf.samples = len(data)
            leaf.class_distribution = {str(k): int(v) for k, v in labels.value_counts().items()}
            return leaf

        # Pick the feature with the highest information gain
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
    if counter is None:
        counter = [0]

    labels = data[target]
    node_id = counter[0]
    counter[0] += 1

    entropy_val = round(float(entropy(labels.tolist())), 4)
    samples = len(data)
    class_dist = labels.value_counts().to_dict()
    class_dist = {str(k): int(v) for k, v in class_dist.items()}

    # Podmienka 1
    # ak vsetky podmienky su jednake tak create list
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

    # Podmienka 2
    # ak nemame priznkay a entropia != 0 tak berieme za odpoved to najvacsie
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
