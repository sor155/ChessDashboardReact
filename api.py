from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import traceback
import libsql_client
from datetime import datetime
import asyncio

# --- Global Database Client ---
# Will be initialized on the first request to ensure it runs inside an event loop.
db_client = None

async def get_db_client():
    """
    Lazily initializes and returns the global database client.
    This ensures initialization happens within an active async event loop.
    """
    global db_client
    if db_client is None:
        print("--- LAZY-INITIALIZING global Turso DB client (first request) ---")
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
    return db_client

# --- Initialize Flask App ---
app = Flask(__name__)
CORS(app)

# --- Helper to convert Row to Dict ---
def rows_to_dicts(rs):
    """Converts a ResultSet object to a list of dictionaries."""
    columns = [col for col in rs.columns]
    return [dict(zip(columns, row)) for row in rs.rows]

# --- API Endpoints ---

@app.route('/api/current-ratings', methods=['GET'])
async def get_current_ratings():
    print("\n--- /api/current-ratings endpoint triggered ---")
    try:
        client = await get_db_client()
        if client is None:
            return jsonify({"error": "Database client failed to initialize."}), 500
        
        rs = await client.execute("SELECT player, rapid, blitz, bullet FROM current_ratings")
        ratings = rows_to_dicts(rs)
        print(f"Successfully fetched {len(ratings)} current ratings.")
        return jsonify(ratings)
    except Exception as e:
        print(f"!!! UNHANDLED EXCEPTION in /api/current-ratings: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred."}), 500

@app.route('/api/rating-history', methods=['GET'])
async def get_rating_history():
    print("\n--- /api/rating-history endpoint triggered ---")
    try:
        client = await get_db_client()
        if client is None:
            return jsonify({"error": "Database client failed to initialize."}), 500
            
        rs = await client.execute("SELECT player, category, rating, date FROM rating_history")
        history = rows_to_dicts(rs)
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
async def get_opening_stats():
    print("\n--- /api/opening-stats endpoint triggered ---")
    try:
        client = await get_db_client()
        if client is None:
            return jsonify({"error": "Database client failed to initialize."}), 500

        rs = await client.execute("SELECT player, opening_name, games_played, white_wins, black_wins, draws FROM opening_stats")
        stats = rows_to_dicts(rs)
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
async def get_eco():
    print("\n--- /api/get-eco endpoint triggered ---")
    try:
        client = await get_db_client()
        if client is None:
            return jsonify({"error": "Database client failed to initialize."}), 500

        data = await request.get_json()
        fen = data.get('fen')
        if not fen:
            return jsonify({"error": "FEN string is required."}), 400
        
        rs = await client.execute("SELECT eco, name FROM opening_stats WHERE fen = ?", [fen])
        
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
    # This endpoint remains synchronous as it doesn't need the DB
    return jsonify(message="Chess API is running.")

# Vercel will run this 'app' object.
