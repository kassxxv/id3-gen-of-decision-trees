# ID3 Decision Tree Generator

Semestral ML project. Implements the ID3 algorithm from scratch to generate decision trees from CSV datasets. Includes a web interface for uploading data, visualizing the tree, and making predictions.

## Stack

- Python / Flask
- D3.js (tree visualization)
- scikit-learn (evaluation metrics only — accuracy, precision, recall, F1)

## Setup

```bash
pip install flask pandas scikit-learn
python app.py
```

Then open [http://localhost:5000](http://localhost:5000).

## Usage

1. Upload a CSV file
2. Select the target column and train/test split
3. Click **Build Tree**
4. Inspect metrics, explore the tree, or make a single prediction
