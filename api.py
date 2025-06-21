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
    Since api.py is now in the root, the path is simpler.
    """
    DATABASE_FILENAME = 'chess_ratings.db'
    db_path = os.path.join(os.path.dirname(__file__), DATABASE_FILENAME)
    
    print(f"Attempting to connect to database at: {db_path}")

    if not os.path.exists(db_path):
        print(f"ERROR: Database file not found at {db_path}.")
        raise sqlite3.OperationalError(f"Database not found at {db_path}")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

# --- API Endpoints ---

@app.route('/api/get-eco', methods=['POST'])
def get_eco():
    """
    Looks up the ECO code for a given FEN position.
    """
    try:
        data = request.get_json()
        fen = data.get('fen')
        if not fen:
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
    except sqlite3.OperationalError as e:
        print(f"DATABASE ERROR in /api/get-eco: {e}")
        return jsonify({"error": "Database connection failed. Check Vercel logs."}), 500
    except Exception as e:
        print(f"GENERAL ERROR in /api/get-eco: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500

# You can add other API routes here as needed.

# Vercel will run this 'app' object.
