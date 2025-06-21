# api/api.py
from flask import Flask, jsonify
from flask_cors import CORS
import os
import json

app = Flask(__name__)
CORS(app)

def read_json_from_api_dir(filename):
    """Reads a JSON file from the /api directory where this script is located."""
    dir_path = os.path.dirname(os.path.realpath(__file__))
    file_path = os.path.join(dir_path, filename)
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except Exception:
        # If file is not found or corrupt, return an empty list.
        return []

@app.route('/api/current-ratings', methods=['GET'])
def get_current_ratings():
    return jsonify(read_json_from_api_dir('current-ratings.json'))

@app.route('/api/rating-history', methods=['GET'])
def get_rating_history():
    return jsonify(read_json_from_api_dir('rating-history.json'))

@app.route('/api/opening-stats', methods=['GET'])
def get_opening_stats():
    return jsonify(read_json_from_api_dir('opening-stats.json'))

@app.route('/api/status', methods=['GET'])
def status():
    return jsonify(message="Chess API is running in static data mode.")