

def predict(node, sample: dict) -> str:
    if node.is_leaf():
        return node.label
    value = sample.get(node.feature)
    # Fallback for unseen values: take the first branch as a best-effort default
    child = node.children.get(value) or next(iter(node.children.values()))
    return predict(child, sample)


def predict_dataset(node, data) -> list:
    """Classify every row in a DataFrame. Returns predictions in row order."""
    return [predict(node, row.to_dict()) for _, row in data.iterrows()]