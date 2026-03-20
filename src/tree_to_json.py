from node import Node

def tree_to_json(node: Node) -> dict:
    # ak list - vratime len label
    if node.is_leaf():
        return {"label": node.label}

    # ak uzol — return feature a rekurzivne children
    return {
        "feature": node.feature,
        "children": {
            value: tree_to_json(child)
            for value, child in node.children.items()
        }
    }