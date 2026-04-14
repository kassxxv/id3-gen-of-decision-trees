from flask import Flask, request, jsonify, render_template
import pandas as pd
import sys, os
from collections import defaultdict

# Ensure the src/ package is importable regardless of how the script is launched
sys.path.append(os.path.join(os.path.dirname(__file__), "src"))

from src.build_tree import build_tree
from src.predict import predict, predict_dataset
from src.metrics import train_test_split, get_metrics
from src.tree_to_json import tree_to_json

app = Flask(__name__)
# Holds the most recently trained tree between requests (single-user dev state)
current_tree = None


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/theory")
def theory():
    return render_template("theory.html")


@app.route("/train", methods=["POST"])
def train():
    """
    Train an ID3 tree on an uploaded CSV and return visualisation data.

    Expects multipart/form-data:
      file      — CSV file
      target    — name of the target column
      test_size — fraction to hold out for evaluation (default 0.2)

    Returns JSON with the tree structure, evaluation metrics, per-step build
    metadata for the animation, and feature importances.
    """
    global current_tree

    data = pd.read_csv(request.files["file"])
    target = request.form["target"]
    features = [col for col in data.columns if col != target]

    test_size = float(request.form.get("test_size", 0.2))
    train_data, test_data = train_test_split(data, test_size=test_size)

    steps = []
    current_tree = build_tree(train_data, features, target, steps=steps)

    m = get_metrics(test_data[target].tolist(), predict_dataset(current_tree, test_data))

    # Feature importance: accumulate total IG contributed by each feature
    # across every node where it was chosen as the best split
    importances = defaultdict(float)
    for step in steps:
        if not step["is_leaf"] and step.get("feature_chosen"):
            importances[step["feature_chosen"]] += step["feature_candidates"][step["feature_chosen"]]
    importances = dict(sorted(importances.items(), key=lambda x: x[1], reverse=True))

    return jsonify({
        "tree":             tree_to_json(current_tree),
        "accuracy":         round(m['accuracy']  * 100, 2),
        "precision":        round(m['precision'] * 100, 2),
        "recall":           round(m['recall']    * 100, 2),
        "f1":               round(m['f1']        * 100, 2),
        "confusion_matrix": m['confusion_matrix'],
        "classes":          m['classes'],
        "train_size":       len(train_data),
        "test_size":        len(test_data),
        # dropna removes NaN rows; astype(str) ensures JSON-serialisable values
        # regardless of the original column dtype (int, float, etc.)
        "feature_values":   {f: sorted(data[f].dropna().astype(str).unique().tolist()) for f in features},
        "feature_importances": importances,
        "build_steps":      steps,
    })


@app.route("/predict", methods=["POST"])
def predict_single():
    if current_tree is None:
        return jsonify({"error": "Tree not built yet"}), 400
    sample = request.get_json()["sample"]
    return jsonify({"prediction": predict(current_tree, sample)})


if __name__ == "__main__":
    app.run(debug=True)
