from flask import Flask, jsonify, request
from flask_cors import CORS
import chess
import chess.svg
import sqlite3
import json
import os

# Initialize Flask App
app = Flask(__name__)

# Enable CORS to allow your React frontend to make requests to this Python backend.
CORS(app)

# --- Database Helper Function ---
def get_db_connection():
    """
    Creates a connection to the SQLite database.
    This now correctly connects to 'chess_ratings.db'.
    """
    # The database file that holds the 'openings' table.
    DATABASE_FILENAME = 'chess_ratings.db'

    # This pathing works in the Vercel environment where 'api.py' is in an 'api/' directory
    # and the database is at the root.
    db_path = os.path.join(os.path.dirname(__file__), '..', DATABASE_FILENAME)

    # A fallback for local development where api.py might be in the root.
    if not os.path.exists(db_path):
        db_path = DATABASE_FILENAME
    
    if not os.path.exists(db_path):
        # This error will be visible in the Vercel function logs if the DB is missing.
        raise sqlite3.OperationalError(f"Database '{DATABASE_FILENAME}' not found at expected path: {db_path}")

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
        cursor = conn.cursor()
        
        # Query the 'openings' table for the given FEN
        cursor.execute('SELECT eco, name FROM openings WHERE fen = ?', (fen,))
        opening = cursor.fetchone()
        conn.close()

        if opening:
            return jsonify({
                "eco": opening['eco'],
                "name": opening['name']
            })
        else:
            return jsonify({
                "eco": "N/A",
                "name": "No opening found for this position."
            })
    except sqlite3.OperationalError as e:
        print(f"DATABASE ERROR in /api/get-eco: {e}")
        return jsonify({"error": "Database connection failed. Please ensure chess_ratings.db is included in the deployment."}), 500
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
            
        # Placeholder evaluation logic
        evaluation = {
            "score": "N/A",
            "bestMove": "N/A"
        }
        
        return jsonify(evaluation)
    except Exception as e:
        print(f"Error in /api/get-eval: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500

# A simple root route to confirm the API is running.
@app.route('/api/status', methods=['GET'])
def status():
    """A simple route to check if the API is up and running."""
    return jsonify(message="Chess API is running!")

# Vercel will run this 'app' object.
