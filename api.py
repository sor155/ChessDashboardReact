from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import traceback
import libsql_client
from datetime import datetime

# --- Global Database Client ---
# We will initialize this once and reuse it across requests.
db_client = None

def init_db_client():
    """
    Initializes the global database client. This function is called once
    when the server starts.
    """
    global db_client
    if db_client is not None:
        return # Already initialized

    print("--- Initializing global Turso DB client ---")
    try:
        url = os.environ.get("TURSO_URL") or os.environ.get("TURSO_DATABASE_URL")
        auth_token = os.environ.get("TURSO_AUTH_TOKEN")

        if not url or not auth_token:
            raise Exception("FATAL: Database credentials (TURSO_URL or TURSO_AUTH_TOKEN) not found in environment variables.")

        if url.startswith("libsql://"):
            url = "https" + url[6:]
        
        db_client = libsql_client.create_client(url=url, auth_token=auth_token)
        print("--- Global Turso DB client INITIALIZED successfully. ---")
    except Exception as e:
        db_client = None # Ensure client is None on failure
        print(f"!!! FATAL ERROR during DB client initialization: {e}")
        traceback.print_exc()

# --- Initialize Flask App and DB Client ---
app = Flask(__name__)
CORS(app)
init_db_client() # Initialize the client when the app starts

# --- Helper to convert Row to Dict ---
def rows_to_dicts(rs):
    """Converts a ResultSet object to a list of dictionaries."""
    columns = [col for col in rs.columns]
    return [dict(zip(columns, row)) for row in rs.rows]

# --- API Endpoints ---

@app.route('/api/current-ratings', methods=['GET'])
def get_current_ratings():
    print("\n--- /api/current-ratings endpoint triggered ---")
    if db_client is None:
        return jsonify({"error": "Database client is not initialized."}), 500
    try:
        rs = db_client.execute("SELECT player, rapid, blitz, bullet FROM current_ratings")
        ratings = rows_to_dicts(rs)
        print(f"Successfully fetched {len(ratings)} current ratings.")
        return jsonify(ratings)
    except Exception as e:
        print(f"!!! UNHANDLED EXCEPTION in /api/current-ratings: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred."}), 500

@app.route('/api/rating-history', methods=['GET'])
def get_rating_history():
    print("\n--- /api/rating-history endpoint triggered ---")
    if db_client is None:
        return jsonify({"error": "Database client is not initialized."}), 500
    try:
        rs = db_client.execute("SELECT player, category, rating, date FROM rating_history")
        history = rows_to_dicts(rs)
        # Handle date conversion safely
        for item in history:
            if item.get('date') and isinstance(item['date'], datetime):
                item['date'] = item['date'].isoformat()
        print(f"Successfully fetched {len(history)} rating history records.")
        return jsonify(history)
    except Exception as e:
        print(f"!!! UNHANDLED EXCEPTION in /api/rating-history: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred."}), 500

@app.route('/api/opening-stats', methods=['GET'])
def get_opening_stats():
    print("\n--- /api/opening-stats endpoint triggered ---")
    if db_client is None:
        return jsonify({"error": "Database client is not initialized."}), 500
    try:
        rs = db_client.execute("SELECT player, opening_name, games_played, white_wins, black_wins, draws FROM opening_stats")
        stats = rows_to_dicts(rs)
        # Calculate losses
        for stat in stats:
            games_played = stat.get('games_played', 0)
            white_wins = stat.get('white_wins', 0)
            black_wins = stat.get('black_wins', 0)
            draws = stat.get('draws', 0)
            stat['losses'] = games_played - (white_wins + black_wins + draws)
        print(f"Successfully fetched {len(stats)} opening stat records.")
        return jsonify(stats)
    except Exception as e:
        print(f"!!! UNHANDLED EXCEPTION in /api/opening-stats: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred."}), 500


@app.route('/api/get-eco', methods=['POST'])
def get_eco():
    print("\n--- /api/get-eco endpoint triggered ---")
    if db_client is None:
        return jsonify({"error": "Database client is not initialized."}), 500
    try:
        data = request.get_json()
        fen = data.get('fen')
        if not fen:
            return jsonify({"error": "FEN string is required."}), 400
        
        rs = db_client.execute("SELECT eco, name FROM opening_stats WHERE fen = ?", [fen])
        
        if len(rs.rows) > 0:
            opening = dict(zip(rs.columns, rs.rows[0]))
            return jsonify({"eco": opening.get("eco"), "name": opening.get("name")})
        else:
            return jsonify({"eco": "N/A", "name": "No opening found."})

    except Exception as e:
        print(f"!!! UNHANDLED EXCEPTION in /api/get-eco: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred."}), 500

@app.route('/api/status', methods=['GET'])
def status():
    if db_client:
        return jsonify(message="Chess API is running and DB client is initialized.")
    else:
        return jsonify(message="Chess API is running but DB client FAILED to initialize."), 500

# Vercel will run this 'app' object.
