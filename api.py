
from flask import Flask, jsonify
from flask_cors import CORS
import os
import json

# Initialize Flask App
app = Flask(__name__)
CORS(app)

def read_json_from_api_dir(filename):
    """
    Reads a JSON file from the /api directory.
    This function handles both local development and Vercel deployment paths.
    """
    # Get the current script's directory
    current_dir = os.path.dirname(os.path.realpath(__file__))
    
    # Try multiple possible paths for the JSON files
    possible_paths = [
        # Path 1: Same directory as this script (for Vercel deployment)
        os.path.join(current_dir, filename),
        # Path 2: Relative to current directory (for local development)
        os.path.join(current_dir, '..', 'api', filename),
        # Path 3: Direct api subdirectory
        os.path.join('api', filename),
        # Path 4: Absolute path from root
        os.path.join(os.getcwd(), 'api', filename)
    ]
    
    for file_path in possible_paths:
        try:
            if os.path.exists(file_path):
                print(f"Found JSON file at: {file_path}")
                with open(file_path, 'r') as f:
                    return json.load(f)
        except Exception as e:
            print(f"Failed to read {file_path}: {e}")
            continue
    
    # If no file found, log the attempted paths and return empty list
    print(f"ERROR: Could not find {filename} in any of these locations:")
    for path in possible_paths:
        print(f"  - {path} (exists: {os.path.exists(path)})")
    
    print(f"Current working directory: {os.getcwd()}")
    print(f"Script directory: {current_dir}")
    print(f"Directory contents: {os.listdir(current_dir) if os.path.exists(current_dir) else 'N/A'}")
    
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

# For debugging - add a route to check file system
@app.route('/api/debug', methods=['GET'])
def debug_filesystem():
    """Debug endpoint to check file system structure"""
    current_dir = os.path.dirname(os.path.realpath(__file__))
    cwd = os.getcwd()
    
    debug_info = {
        "script_directory": current_dir,
        "current_working_directory": cwd,
        "script_dir_contents": os.listdir(current_dir) if os.path.exists(current_dir) else [],
        "cwd_contents": os.listdir(cwd),
        "api_dir_exists": os.path.exists(os.path.join(cwd, 'api')),
        "api_dir_contents": os.listdir(os.path.join(cwd, 'api')) if os.path.exists(os.path.join(cwd, 'api')) else []
    }
    
    return jsonify(debug_info)