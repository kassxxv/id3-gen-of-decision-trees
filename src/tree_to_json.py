from node import Node


def tree_to_json(node: Node) -> dict:
    """Recursively convert a Node tree into a nested dict safe for JSON serialisation."""
    if node.is_leaf():
        return {
            "label": node.label,
            "entropy": node.entropy,
            "samples": node.samples,
            "class_distribution": node.class_distribution
        }

    return {
        "feature": node.feature,
        "entropy": node.entropy,
        "information_gain": node.information_gain,
        "samples": node.samples,
        "class_distribution": node.class_distribution,
        "children": {
            value: tree_to_json(child)
            for value, child in node.children.items()
        }
    }