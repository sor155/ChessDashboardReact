import sqlite3
import requests
from datetime import datetime
import pandas as pd
import sys
from collections import defaultdict

# --- CONFIGURATION ---
DB_NAME = "chess_ratings.db"
FRIENDS = [
    ("Ulysse", "RealUlysse", ""),
    ("Simon", "Poulet_tao", ""),
    ("Adrien", "adrienbourque", ""),
    ("Alex", "naatiry", ""),
    ("Kevin", "Kevor24", ""),
]
MANUAL_STARTING_RATINGS = {
    "Simon": {"C - Blitz": 412, "C - Rapid": 1006, "C - Bullet": 716},
    "Ulysse": {"C - Blitz": 1491, "C - Rapid": 1971, "C - Bullet": 1349},
    "Alex": {"C - Blitz": 268, "C - Rapid": 841, "C - Bullet": 487},
    "Adrien": {"C - Rapid": 1619, "C - Bullet": 747, "C - Blitz": 1163},
    "Kevin": {"C - Bullet": 577, "C - Rapid": 702, "C - Blitz": 846}
}

# --- HELPER FUNCTIONS ---
def get_api_data(username):
    if not username: return None
    url = f"https://api.chess.com/pub/player/{username}/stats"
    try:
        response = requests.get(url, headers={"User-Agent": "PythonChessTracker/2.0"})
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"  ERROR (Chess.com for '{username}'): {e}")
        return None

def calculate_diff(new, old):
    if isinstance(new, int) and isinstance(old, int): return new - old
    return None

def safe_wld(stats):
    try:
        w, l, d = int(stats.get("win",0)), int(stats.get("loss",0)), int(stats.get("draw",0))
        return f"{w}/{l}/{d}"
    except: return "0/0/0"

def safe_int(val):
    try: return int(val)
    except (ValueError, TypeError): return None

def get_stats_from_data(data, category):
    stats = {"rating": None, "win": 0, "loss": 0, "draw": 0}
    category_data = data.get(f"chess_{category}", {}) if data else {}
    if category_data:
        stats["rating"] = category_data.get("last", {}).get("rating")
        record = category_data.get("record", {}) or {}
        stats["win"], stats["loss"], stats["draw"] = record.get("win", 0), record.get("loss", 0), record.get("draw", 0)
    return stats

def get_baseline_rating(conn, player, cat):
    if player in MANUAL_STARTING_RATINGS and cat in MANUAL_STARTING_RATINGS[player]:
        return MANUAL_STARTING_RATINGS[player][cat]
    c = conn.cursor()
    c.execute("SELECT rating FROM rating_history WHERE player_name = ? AND category = ? ORDER BY timestamp ASC LIMIT 1", (player, cat))
    result = c.fetchone()
    return result[0] if result else None

def get_current_ratings_from_db(conn):
    """Reads the last known ratings from the database."""
    ratings = defaultdict(dict)
    try:
        df = pd.read_sql_query("SELECT friend_name, rapid_rating, blitz_rating, bullet_rating FROM current_ratings", conn)
        for _, row in df.iterrows():
            ratings[row['friend_name']] = {
                'rapid': row['rapid_rating'],
                'blitz': row['blitz_rating'],
                'bullet': row['bullet_rating'],
            }
    except pd.io.sql.DatabaseError:
        print("Warning: 'current_ratings' table not found or empty. Assuming no prior data.")
    return ratings

def run_update():
    """Fetches new ratings, compares them to existing ones, and updates the DB only if there are changes."""
    print(f"\n--- Running update check at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ---")
    
    try:
        conn = sqlite3.connect(DB_NAME)
    except sqlite3.Error as e:
        print(f"FATAL: Could not connect to database {DB_NAME}. Error: {e}")
        sys.exit(1)

    with conn:
        # Step 1: Read existing ratings from DB
        last_ratings = get_current_ratings_from_db(conn)
        
        # Step 2: Fetch new ratings and store them
        new_data = {}
        has_changed = False
        for name, chesscom_user, _ in FRIENDS:
            print(f"Fetching ratings for {name}...")
            api_data = get_api_data(chesscom_user)
            
            new_ratings = {
                'rapid': safe_int(get_stats_from_data(api_data, "rapid")['rating']),
                'blitz': safe_int(get_stats_from_data(api_data, "blitz")['rating']),
                'bullet': safe_int(get_stats_from_data(api_data, "bullet")['rating']),
            }
            new_data[name] = {'ratings': new_ratings, 'api_data': api_data}
            
            # Step 3: Compare new ratings with old ones
            if last_ratings[name] != new_ratings:
                print(f"  Change detected for {name}.")
                has_changed = True

    # Step 4: If no changes were detected, exit gracefully
    if not has_changed:
        print("\nNo rating changes detected. Database remains untouched.")
        return

    # Step 5: If there ARE changes, proceed with the full update
    print("\nRating changes detected. Updating database...")
    with conn:
        history_rows_to_append = []
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        for name, data in new_data.items():
            api_data = data['api_data']
            rapid = get_stats_from_data(api_data, "rapid")
            blitz = get_stats_from_data(api_data, "blitz")
            bullet = get_stats_from_data(api_data, "bullet")
            
            rapid_rating, blitz_rating, bullet_rating = data['ratings']['rapid'], data['ratings']['blitz'], data['ratings']['bullet']

            baseline_rapid = get_baseline_rating(conn, name, 'C - Rapid')
            baseline_blitz = get_baseline_rating(conn, name, 'C - Blitz')
            baseline_bullet = get_baseline_rating(conn, name, 'C - Bullet')

            current_row_data = (
                name, rapid_rating, safe_wld(rapid), calculate_diff(rapid_rating, baseline_rapid),
                blitz_rating, safe_wld(blitz), calculate_diff(blitz_rating, baseline_blitz),
                bullet_rating, safe_wld(bullet), calculate_diff(bullet_rating, baseline_bullet),
            )
            conn.execute('INSERT OR REPLACE INTO current_ratings VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', current_row_data)

            if rapid_rating is not None: history_rows_to_append.append((timestamp, name, "C - Rapid", rapid_rating))
            if blitz_rating is not None: history_rows_to_append.append((timestamp, name, "C - Blitz", blitz_rating))
            if bullet_rating is not None: history_rows_to_append.append((timestamp, name, "C - Bullet", bullet_rating))

        if history_rows_to_append:
            print("Writing new data to 'rating_history' table...")
            conn.executemany('INSERT INTO rating_history (timestamp, player_name, category, rating) VALUES (?,?,?,?)', history_rows_to_append)

    print("\n✅ SQLite database update complete!")

if __name__ == "__main__":
    run_update()
