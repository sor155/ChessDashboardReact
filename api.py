import sqlite3
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
# CORS is needed to allow your React app (running on port 3000)
# to make requests to your API (running on port 5000)
CORS(app)

DATABASE_PATH = 'chess_ratings.db'

def query_db(query, args=(), one=False):
    """A helper function to query the database and return results."""
    try:
        with sqlite3.connect(DATABASE_PATH) as conn:
            conn.row_factory = sqlite3.Row # This allows accessing columns by name
            cur = conn.cursor()
            cur.execute(query, args)
            rv = cur.fetchall()
            cur.close()
            # Return a list of dictionaries
            return (rv[0] if rv else None) if one else [dict(ix) for ix in rv]
    except sqlite3.OperationalError as e:
        print(f"Database error: {e}")
        return None


@app.route('/api/ratings/current')
def get_current_ratings():
    """API endpoint to get the current ratings."""
    # The SQL query is based on your original streamlit_app_sqlite.py
    ratings = query_db('SELECT * FROM current_ratings')
    if ratings is None:
        return jsonify({"error": "Could not retrieve current ratings. Is the database created and populated?"}), 500
    return jsonify(ratings)


@app.route('/api/ratings/history')
def get_rating_history():
    """API endpoint to get the full rating history."""
    history = query_db('SELECT * FROM rating_history')
    if history is None:
         return jsonify({"error": "Could not retrieve rating history."}), 500
    return jsonify(history)


if __name__ == '__main__':
    # Runs the API server on http://localhost:5000
    app.run(debug=True, port=5000)

