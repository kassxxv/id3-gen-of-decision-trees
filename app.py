from flask import Flask, request, jsonify, render_template
import pandas as pd
import json
import io
import sys
sys.path.append("src")  # чтобы Flask видел твои модули

from build_tree import build_tree
from predict import predict_dataset
from metrics import train_test_split, accuracy
from tree_to_json import tree_to_json

app = Flask(__name__)

# Главная страница
@app.route("/")
def index():
    return render_template("index.html")

# Загрузка датасета и построение дерева
@app.route("/train", methods=["POST"])
def train():
    file = request.files["file"]
    target = request.form["target"]

    # Читаем CSV
    data = pd.read_csv(file)
    features = [col for col in data.columns if col != target]

    # Строим дерево
    train_data, test_data = train_test_split(data, test_size=0.2)
    tree = build_tree(train_data, features, target)

    # Считаем точность
    y_real = test_data[target].tolist()
    y_predicted = predict_dataset(tree, test_data)
    acc = accuracy(y_real, y_predicted)

    # Возвращаем JSON с деревом и метриками
    return jsonify({
        "tree": tree_to_json(tree),
        "accuracy": round(acc * 100, 2),
        "train_size": len(train_data),
        "test_size": len(test_data)
    })

if __name__ == "__main__":
    app.run(debug=True)