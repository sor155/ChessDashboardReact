from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import traceback
import libsql_client
from datetime import datetime

# Initialize Flask App
app = Flask(__name__)
CORS(app)

# --- Turso Database Helper Function ---
def get_db_connection():
    """
    Creates a connection to the remote Turso database using environment variables
    set by the Vercel integration.
    """
    url = os.environ.get("TURSO_URL") or os.environ.get("TURSO_DATABASE_URL")
    auth_token = os.environ.get("TURSO_AUTH_TOKEN")

    if not url or not auth_token:
        print("FATAL ERROR: Database credentials not found in environment variables.")
        raise Exception("Database credentials not found in environment variables.")

    # Force HTTPS for reliability in some environments
    if url.startswith("libsql://"):
        url = "https" + url[6:]

    print(f"Connecting to Turso with URL: {url}")
    return libsql_client.create_client(url=url, auth_token=auth_token)

# --- API Endpoints ---

@app.route('/api/current-ratings', methods=['GET'])
def get_current_ratings():
    """
    Fetches the latest rating for each player from the 'current_ratings' table.
    """
    print("\n--- /api/current-ratings endpoint triggered ---")
    try:
        client = get_db_connection()
        rs = client.execute("SELECT player, rapid, blitz, bullet FROM current_ratings")
        # --- FIX ---
        # Manually create the dictionary from columns and row values for robustness.
        ratings = [dict(zip(rs.columns, row)) for row in rs.rows]
        print(f"Successfully fetched {len(ratings)} current ratings.")
        return jsonify(ratings)
    except Exception as e:
        print(f"!!! UNHANDLED EXCEPTION in /api/current-ratings: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred."}), 500

@app.route('/api/rating-history', methods=['GET'])
def get_rating_history():
    """
    Fetches all rating history for the progression graph from the 'rating_history' table.
    """
    print("\n--- /api/rating-history endpoint triggered ---")
    try:
        client = get_db_connection()
        rs = client.execute("SELECT player, category, rating, date FROM rating_history")
        # --- FIX ---
        # Manually create the dictionary from columns and row values for robustness.
        history = [dict(zip(rs.columns, row)) for row in rs.rows]
        print(f"Successfully fetched {len(history)} rating history records.")
        return jsonify(history)
    except Exception as e:
        print(f"!!! UNHANDLED EXCEPTION in /api/rating-history: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred."}), 500

@app.route('/api/opening-stats', methods=['GET'])
def get_opening_stats():
    """
    **FIXED ENDPOINT**
    Fetches player statistics and calculates the number of losses.
    """
    print("\n--- /api/opening-stats endpoint triggered ---")
    try:
        client = get_db_connection()
        # Query without the non-existent 'losses' column
        rs = client.execute("SELECT player, opening_name, games_played, white_wins, black_wins, draws FROM opening_stats")

        columns = rs.columns
        stats = []

        # Process rows and calculate losses manually
        for row in rs.rows:
            stat_dict = dict(zip(columns, row))
            
            # Safely get values, defaulting to 0 if null
            games_played = stat_dict.get('games_played') or 0
            white_wins = stat_dict.get('white_wins') or 0
            black_wins = stat_dict.get('black_wins') or 0
            draws = stat_dict.get('draws') or 0
            
            # Calculate losses and add it to the dictionary
            stat_dict['losses'] = games_played - (white_wins + black_wins + draws)
            stats.append(stat_dict)

        print(f"Successfully fetched and processed {len(stats)} opening stat records.")
        return jsonify(stats)
    except Exception as e:
        print(f"!!! UNHANDLED EXCEPTION in /api/opening-stats: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred."}), 500


@app.route('/api/get-eco', methods=['POST'])
def get_eco():
    """
    Looks up the opening name for a given FEN from the 'opening_stats' table.
    """
    print("\n--- /api/get-eco endpoint triggered ---")
    try:
        data = request.get_json()
        fen = data.get('fen')
        if not fen:
            return jsonify({"error": "FEN string is required."}), 400

        client = get_db_connection()
        
        print(f"Querying 'opening_stats' for FEN: {fen}")
        rs = client.execute("SELECT eco, name FROM opening_stats WHERE fen = ?", [fen])
        
        if len(rs.rows) > 0:
            opening = dict(zip(rs.columns, rs.rows[0]))
            eco = opening.get("eco")
            name = opening.get("name")
            print(f"Opening found: {eco} - {name}")
            return jsonify({"eco": eco, "name": name})
        else:
            print("No opening found for this FEN in opening_stats.")
            return jsonify({"eco": "N/A", "name": "No opening found."})

    except Exception as e:
        print(f"!!! UNHANDLED EXCEPTION in /api/get-eco: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred."}), 500

@app.route('/api/status', methods=['GET'])
def status():
    return jsonify(message="Chess API is running and configured for Turso!")

# Vercel will run this 'app' object.
