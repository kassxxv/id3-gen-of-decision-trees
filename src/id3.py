import numpy as np
import pandas as pd


def entropy(labels:list[str]) -> float:
    total = len(labels) # we count how far is this list of target)values
    if total == 0:
        return 0
    counts =  pd.Series(labels).value_counts() # here we calculate count of each unique value(for ex yes 7 times, no 3 times)

    # p = counts / total
    # return -np.sum(p * np.log2(p))

    result = 0
    for count in counts: # for each mark
        p =  count / total # for the mark we count weight / it is dominated or no, as much one dominate as less chaotic it is
        result -= p*np.log2(p) # formula for entropy
    return result

def information_gain(dataset, feature:str, predicted_value:str) -> float:
    entropy_before = entropy(dataset[predicted_value])

    total = len(dataset)
    entropy_after = 0
    for value in dataset[feature].unique():
        subset = dataset[dataset[feature] == value]
        weight = len(subset) / total
        entropy_after += weight * entropy(subset[predicted_value])
    return entropy_before - entropy_after