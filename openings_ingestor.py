import sqlite3
import requests
import time
from chess.pgn import read_game
from io import StringIO
import json
import os

DATABASE_PATH = 'chess_ratings.db'
# List of your local ECO files
ECO_FILES = ['ecoA.json', 'ecoB.json', 'ecoC.json', 'ecoD.json', 'ecoE.json']

FRIENDS = [
    {"name": "Ulysse", "username": "realulysse"},
    {"name": "Simon", "username": "poulet_tao"},
    {"name": "Adrien", "username": "adrienbourque"},
    {"name": "Alex", "username": "naatiry"},
    {"name": "Kevin", "username": "kevor24"},
]

# Add a User-Agent header to mimic a browser request
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
}

def load_eco_data():
    """Loads and combines all local ECO json files into a FEN-keyed dictionary."""
    eco_fen_map = {}
    print("Loading local ECO files...")
    for filename in ECO_FILES:
        if os.path.exists(filename):
            try:
                with open(filename, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for opening in data:
                        if 'fen' in opening:
                            # Use only the board position part of the FEN for the key
                            fen_key = opening['fen'].split(' ')[0]
                            eco_fen_map[fen_key] = opening['name']
                print(f"  - Successfully loaded {filename}")
            except (json.JSONDecodeError, IOError) as e:
                print(f"Error loading {filename}: {e}")
        else:
            print(f"Warning: ECO file '{filename}' not found. Skipping.")
    
    if not eco_fen_map:
        print("Warning: No local ECO data was loaded. Opening name resolution will be limited.")
    
    return eco_fen_map

ECO_DATA = load_eco_data()

def get_opening_name(game):
    """
    Identifies the opening name by checking the game's PGN headers and then
    iterating through moves to find the most specific match in the ECO database.
    """
    # 1. Prioritize PGN Headers - this is often the most direct source
    if 'Opening' in game.headers and game.headers['Opening'] != '?':
        return game.headers['Opening'].split(':')[0].strip()

    # 2. Iterate through moves to find the best FEN match in our local ECO data
    if ECO_DATA:
        board = game.board()
        best_match_name = "Unknown Opening"
        
        # Check the initial position first
        initial_fen_key = board.fen().split(' ')[0]
        if initial_fen_key in ECO_DATA:
            best_match_name = ECO_DATA[initial_fen_key]

        # Then check after each move
        for move in game.mainline_moves():
            board.push(move)
            fen_key = board.fen().split(' ')[0]
            if fen_key in ECO_DATA:
                best_match_name = ECO_DATA[fen_key]
        
        return best_match_name.split(':')[0].strip()

    return 'Unknown Opening'

def create_openings_table():
    with sqlite3.connect(DATABASE_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS opening_stats (
                player_username TEXT,
                opening_name TEXT,
                color TEXT,
                games_played INTEGER,
                wins INTEGER,
                losses INTEGER,
                draws INTEGER,
                PRIMARY KEY (player_username, opening_name, color)
            )
        ''')

def update_opening_stats():
    with sqlite3.connect(DATABASE_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM opening_stats')

        for friend in FRIENDS:
            username = friend['username']
            print(f"Fetching games for {username}...")

            try:
                archives_res = requests.get(f"https://api.chess.com/pub/player/{username}/games/archives", headers=HEADERS)
                archives_res.raise_for_status()
                archive_urls = reversed(archives_res.json().get('archives', []))

                white_games_found = 0
                black_games_found = 0
                white_openings = {}
                black_openings = {}

                for url in archive_urls:
                    if white_games_found >= 10 and black_games_found >= 10:
                        break 

                    print(f"  - Fetching {url}")
                    games_res = requests.get(url, headers=HEADERS)
                    games_res.raise_for_status()
                    games_data = reversed(games_res.json().get('games', []))

                    for game_data in games_data:
                        if game_data.get('rules') != 'chess':
                            continue
                        
                        pgn_io = StringIO(game_data['pgn'])
                        game = read_game(pgn_io)
                        if game is None:
                            continue

                        player_color = 'white' if game.headers['White'].lower() == username.lower() else 'black'

                        if player_color == 'white' and white_games_found >= 10:
                            continue
                        if player_color == 'black' and black_games_found >= 10:
                            continue
                        
                        opening_name = get_opening_name(game)
                        
                        if player_color == 'white':
                           white_games_found +=1
                           openings = white_openings
                        else:
                           black_games_found +=1
                           openings = black_openings

                        result = game.headers['Result']
                        player_result = 'draw'
                        if (player_color == 'white' and result == '1-0') or \
                           (player_color == 'black' and result == '0-1'):
                            player_result = 'win'
                        elif (player_color == 'white' and result == '0-1') or \
                             (player_color == 'black' and result == '1-0'):
                            player_result = 'loss'

                        if opening_name not in openings:
                            openings[opening_name] = {'games': 0, 'wins': 0, 'losses': 0, 'draws': 0}

                        openings[opening_name]['games'] += 1
                        if player_result == 'win':
                            openings[opening_name]['wins'] += 1
                        elif player_result == 'loss':
                            openings[opening_name]['losses'] += 1
                        else:
                            openings[opening_name]['draws'] += 1
                    time.sleep(1) 

                for opening, stats in white_openings.items():
                    cursor.execute('''
                        INSERT OR REPLACE INTO opening_stats (player_username, opening_name, color, games_played, wins, losses, draws)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (username, opening, 'white', stats['games'], stats['wins'], stats['losses'], stats['draws']))

                for opening, stats in black_openings.items():
                    cursor.execute('''
                        INSERT OR REPLACE INTO opening_stats (player_username, opening_name, color, games_played, wins, losses, draws)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (username, opening, 'black', stats['games'], stats['wins'], stats['losses'], stats['draws']))
                
                conn.commit()
                print(f"Finished processing for {username}")

            except requests.exceptions.RequestException as e:
                print(f"Could not fetch data for {username}: {e}")

if __name__ == '__main__':
    create_openings_table()
    update_opening_stats()
    print("Opening stats updated.")