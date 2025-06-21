from flask import Flask, jsonify
from flask_cors import CORS
import os
import json

# Initialize Flask App
app = Flask(__name__)
CORS(app)

def read_json_from_api_dir(filename):
    """
    Reads a JSON file from the /api directory where this script is located.
    This is the standard way to handle file paths in Vercel serverless functions.
    """
    dir_path = os.path.dirname(os.path.realpath(__file__))
    file_path = os.path.join(dir_path, filename)
    
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"ERROR reading {file_path}: {e}")
        # Return an empty list if the file is missing or corrupt
        return []

# --- API Endpoints (Now serving static JSON files) ---

@app.route('/api/current-ratings', methods=['GET'])
def get_current_ratings():
    """Serves the pre-generated current ratings from a local JSON file."""
    print("\n--- /api/current-ratings triggered (serving static data) ---")
    data = read_json_from_api_dir('current-ratings.json')
    return jsonify(data)

@app.route('/api/rating-history', methods=['GET'])
def get_rating_history():
    """Serves the pre-generated rating history from a local JSON file."""
    print("\n--- /api/rating-history triggered (serving static data) ---")
    data = read_json_from_api_dir('rating-history.json')
    return jsonify(data)

@app.route('/api/opening-stats', methods=['GET'])
def get_opening_stats():
    """Serves the pre-generated opening stats from a local JSON file."""
    print("\n--- /api/opening-stats triggered (serving static data) ---")
    data = read_json_from_api_dir('opening-stats.json')
    return jsonify(data)

@app.route('/api/status', methods=['GET'])
def status():
    return jsonify(message="Chess API is running in stable static mode.")

# Vercel will run this 'app' object.
