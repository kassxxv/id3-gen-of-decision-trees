from node import Node
from id3 import information_gain

def build_tree(data, features: list, target: str) -> Node:
    labels = data[target]  # vsetky ano/nie napriklad v datasete
    # Podmienka 1
    # ak vsetky podmienky su jednake tak create list
    if len(labels.unique()) == 1:
        leaf = Node()
        leaf.label = labels.iloc[0]
        return leaf

    # Podmienka 2
    # ak nemame priznkay a entropia != 0 tak berieme za odpoved to najvacsie
    if len(features) == 0:
        leaf = Node()
        leaf.label = labels.value_counts().idxmax()
        return leaf

    gains = {}
    for feature in features:
        gains[feature] = information_gain(data, feature, target)

    best_feature = max(gains, key=gains.get)
    node = Node()
    node.feature = best_feature

    remaining_features = [feature for feature in features if feature != best_feature]

    for value in data[best_feature].unique():
        subset = data[data[best_feature] == value]
        node.children[value] = build_tree(subset, remaining_features, target)

    return node