def predict(node, sample: dict) -> str:
    if node.is_leaf():
        return node.label
    value = sample.get(node.feature)
    child = node.children.get(value) or next(iter(node.children.values()))
    return predict(child, sample)


def predict_dataset(node, data) -> list:
    return [predict(node, row.to_dict()) for _, row in data.iterrows()]