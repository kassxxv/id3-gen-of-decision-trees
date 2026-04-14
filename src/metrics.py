from sklearn.metrics import confusion_matrix, precision_score, recall_score, f1_score


def train_test_split(data, test_size=0.2):
    """
    Shuffle and split data into (train, test) DataFrames.

    random_state=42 ensures reproducible splits across runs. The first
    `test_count` rows (post-shuffle) become the test set; the remainder
    become training data.
    """
    data = data.sample(frac=1, random_state=42).reset_index(drop=True)
    test_count = int(len(data) * test_size)
    return data[test_count:], data[:test_count]


def get_metrics(y_real, y_predicted) -> dict:
    """
    Compute classification metrics from ground-truth and predicted label lists.

    sklearn's precision/recall/f1 require an explicit `average` strategy:
    'binary' (with pos_label) for two-class problems and 'weighted' for
    multi-class so that each class is weighted by its support in y_real.
    """
    classes = sorted(set(y_real) | set(y_predicted))
    avg = 'binary' if len(classes) == 2 else 'weighted'
    kwargs = {'average': avg, 'zero_division': 0}
    if avg == 'binary':
        # sorted() guarantees the second class (index 1) is the positive label
        kwargs['pos_label'] = classes[1]

    cm = confusion_matrix(y_real, y_predicted, labels=classes)
    return {
        'accuracy':  sum(r == p for r, p in zip(y_real, y_predicted)) / len(y_real),
        'precision': precision_score(y_real, y_predicted, **kwargs),
        'recall':    recall_score(y_real, y_predicted, **kwargs),
        'f1':        f1_score(y_real, y_predicted, **kwargs),
        'confusion_matrix': cm.tolist(),
        'classes':   classes,
    }