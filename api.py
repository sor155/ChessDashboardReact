from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import json
import os
import traceback

# Initialize Flask App
app = Flask(__name__)
CORS(app)

# --- Database Helper Function ---
def get_db_connection():
    """
    Creates a connection to the SQLite database.
    This version has extensive logging to debug file paths on Vercel.
    """
    DATABASE_FILENAME = 'chess_ratings.db'
    
    # In Vercel's serverless environment, all project files are usually in '/var/task/'.
    task_root = '/var/task/'
    
    print("--- Vercel Environment File Scan ---")
    print(f"Current Working Directory: {os.getcwd()}")
    print(f"Listing files in CWD: {os.listdir(os.getcwd())}")
    
    if os.path.exists(task_root):
        print(f"Listing files in {task_root}: {os.listdir(task_root)}")
    else:
        print(f"Directory {task_root} does not exist.")

    db_path = os.path.join(task_root, DATABASE_FILENAME)
    
    print(f"Attempting to connect to database at default path: {db_path}")

    if not os.path.exists(db_path):
        print(f"ERROR: Database file not found at {db_path}.")
        # As a fallback, try the current working directory for local testing
        local_path = os.path.join(os.getcwd(), DATABASE_FILENAME)
        if os.path.exists(local_path):
             print(f"SUCCESS: Found database at local path: {local_path}")
             db_path = local_path
        else:
             print(f"FATAL: Database file not found anywhere. Please ensure '{DATABASE_FILENAME}' is in the root of your Git repository.")
             raise sqlite3.OperationalError(f"Database not found.")
    
    print(f"Connecting to final DB path: {db_path}")
    # Force read-only mode, which is required for Vercel's filesystem
    conn = sqlite3.connect(f'file:{db_path}?mode=ro', uri=True)
    conn.row_factory = sqlite3.Row
    return conn

# --- API Endpoints ---

@app.route('/api/get-eco', methods=['POST'])
def get_eco():
    print("\n--- /api/get-eco endpoint triggered ---")
    try:
        data = request.get_json()
        fen = data.get('fen')
        if not fen:
            print("Request failed: FEN string is required.")
            return jsonify({"error": "FEN string is required."}), 400

        conn = get_db_connection()
        print("Database connection successful.")
        cursor = conn.cursor()
        
        print(f"Querying for FEN: {fen}")
        cursor.execute('SELECT eco, name FROM openings WHERE fen = ?', (fen,))
        opening = cursor.fetchone()
        conn.close()

        if opening:
            print(f"Opening found: {opening['eco']} - {opening['name']}")
            return jsonify({
                "eco": opening['eco'],
                "name": opening['name']
            })
        else:
            print("No opening found for this FEN.")
            return jsonify({
                "eco": "N/A",
                "name": "No opening found for this position."
            })
    except Exception as e:
        # This will catch ANY error and log it with a full traceback.
        print(f"!!! UNHANDLED EXCEPTION in /api/get-eco: {e}")
        traceback.print_exc()
        return jsonify({"error": "A critical internal server error occurred. Check Vercel function logs for details."}), 500

# You can add other API routes here as needed.
# Vercel will run this 'app' object.
