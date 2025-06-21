from flask import Flask, jsonify, request
from flask_cors import CORS
import chess
import chess.svg
import sqlite3
import json

# Initialize Flask App
app = Flask(__name__)

# It's important to enable CORS to allow your React frontend
# to make requests to this Python backend.
# For production, you might want to restrict the origin to your frontend's Vercel URL.
CORS(app)

# --- Database Helper Function ---
def get_db_connection():
    """Creates a connection to the SQLite database."""
    # Note: For Vercel deployment, the filesystem is read-only except for the /tmp directory.
    # This means that writing to the database after deployment might not persist.
    # For a production application, consider using a serverless database like Vercel Postgres.
    conn = sqlite3.connect('openings.db')
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
        cursor = conn.cursor()
        
        # Query the database for the given FEN
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
                "eco": "Unknown",
                "name": "No opening found for this position."
            })
    except Exception as e:
        # Log the error for debugging
        print(f"Error in /api/get-eco: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500


@app.route('/api/get-eval', methods=['POST'])
def get_eval():
    """
    This is a placeholder for a chess position evaluation function.
    Implementing a real-time evaluation would require a chess engine like Stockfish,
    which is complex to run in a standard serverless environment.
    
    For now, this endpoint returns a placeholder evaluation.
    """
    try:
        data = request.get_json()
        fen = data.get('fen')
        if not fen:
            return jsonify({"error": "FEN string is required."}), 400
            
        # Placeholder evaluation logic
        # In a real application, you would integrate a chess engine here.
        evaluation = {
            "score": "+0.1",
            "best_move": "e2e4"
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
# The following block is for local development and will not run on Vercel.
if __name__ == '__main__':
    app.run(debug=True, port=5000)
