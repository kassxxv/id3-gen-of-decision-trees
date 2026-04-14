import numpy as np
import pandas as pd


def entropy(labels: list[str]) -> float:
    """
    Compute Shannon entropy over a label list.

    Returns 0.0 for an empty list to avoid log(0) errors at pure or empty nodes.
    """
    total = len(labels)
    if total == 0:
        return 0
    p = pd.Series(labels).value_counts() / total
    return -np.sum(p * np.log2(p))


def information_gain(dataset, feature: str, predicted_value: str) -> float:
    """
    Compute the information gain of splitting `dataset` on `feature`.

    Weighting by subset size ensures that a split producing one large pure child
    ranks correctly above one that creates many tiny pure subsets.
    """
    entropy_before = entropy(dataset[predicted_value])

    total = len(dataset)
    entropy_after = 0
    for value in dataset[feature].unique():
        subset = dataset[dataset[feature] == value]
        weight = len(subset) / total
        entropy_after += weight * entropy(subset[predicted_value])

    return entropy_before - entropy_after