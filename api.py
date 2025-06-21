from flask import Flask, jsonify, request
from flask_cors import CORS
import chess
import chess.svg
import sqlite3
import json
import os

# Initialize Flask App
app = Flask(__name__)
CORS(app)

# --- Database Helper Function ---
def get_db_connection():
    """
    Creates a connection to the SQLite database.
    This version simplifies the path and adds logging for debugging on Vercel.
    """
    DATABASE_FILENAME = 'chess_ratings.db'
    
    # In Vercel's serverless environment, all project files are placed in '/var/task/'.
    # So, the script and the database should be in the same directory.
    db_path = os.path.join('/var/task/', DATABASE_FILENAME)
    
    # Log the path we are trying to use. This is crucial for debugging.
    print(f"Attempting to connect to database at: {db_path}")

    if not os.path.exists(db_path):
        # Log an error if the file doesn't exist at the expected path.
        print(f"ERROR: Database file not found at {db_path}. Please ensure '{DATABASE_FILENAME}' is at the root of your project.")
        # As a fallback for local testing, check the current script's directory.
        local_path = os.path.join(os.path.dirname(__file__), DATABASE_FILENAME)
        if os.path.exists(local_path):
             print(f"Found database locally at: {local_path}")
             db_path = local_path
        else:
             raise sqlite3.OperationalError(f"Database not found at Vercel path or local path.")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

# --- API Endpoints ---

@app.route('/api/get-eco', methods=['POST'])
def get_eco():
    """
    Looks up the ECO code for a given FEN position from the chess_ratings.db database.
    """
    try:
        data = request.get_json()
        fen = data.get('fen')
        if not fen:
            return jsonify({"error": "FEN string is required."}), 400

        conn = get_db_connection()
        print("Database connection successful.")
        cursor = conn.cursor()
        
        # Query the 'openings' table for the given FEN
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
    except sqlite3.OperationalError as e:
        print(f"DATABASE ERROR in /api/get-eco: {e}")
        return jsonify({"error": "Database connection failed. Check Vercel logs for path details."}), 500
    except Exception as e:
        print(f"GENERAL ERROR in /api/get-eco: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500


@app.route('/api/get-eval', methods=['POST'])
def get_eval():
    """
    This is a placeholder for a chess position evaluation function.
    """
    try:
        data = request.get_json()
        fen = data.get('fen')
        if not fen:
            return jsonify({"error": "FEN string is required."}), 400
            
        evaluation = {
            "score": "N/A",
            "bestMove": "N/A"
        }
        
        return jsonify(evaluation)
    except Exception as e:
        print(f"Error in /api/get-eval: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500

@app.route('/api/status', methods=['GET'])
def status():
    """A simple route to check if the API is up and running."""
    return jsonify(message="Chess API is running!")

# Vercel will run this 'app' object.
