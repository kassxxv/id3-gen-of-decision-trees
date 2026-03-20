import numpy as np
import pandas as pd


def entropy(labels:list[str]) -> float:
    total = len(labels) # we count how far is this list of target values
    if total == 0:
        return 0
    p = pd.Series(labels).value_counts() / total
    return -np.sum(p * np.log2(p))


def information_gain(dataset, feature:str, predicted_value:str) -> float:
    entropy_before = entropy(dataset[predicted_value])

    total = len(dataset)
    entropy_after = 0
    for value in dataset[feature].unique():
        subset = dataset[dataset[feature] == value]
        weight = len(subset) / total
        entropy_after += weight * entropy(subset[predicted_value])
    return entropy_before - entropy_after