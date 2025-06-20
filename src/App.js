import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

// --- Theme and Utility Hooks ---
const useTheme = () => {
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove(theme === 'light' ? 'dark' : 'light');
        root.classList.add(theme);
        localStorage.setItem('theme', theme);
    }, [theme]);
    return [theme, setTheme];
};

// --- API & Data Fetching ---
const API_BASE_URL = 'http://localhost:5000/api';

const FRIENDS = [
    { name: "Ulysse", username: "realulysse" },
    { name: "Simon", username: "poulet_tao" },
    { name: "Adrien", username: "adrienbourque" },
    { name: "Alex", username: "naatiry" },
    { name: "Kevin", username: "kevor24" },
];

async function fetchData(endpoint) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        if (!response.ok) throw new Error(`Network response was not ok for ${endpoint}`);
        return await response.json();
    } catch (error) {
        console.error(`Failed to fetch ${endpoint}:`, error);
        return [];
    }
}

async function fetchPlayerAnalysis(username) {
    // This function remains the same as it fetches from the external Chess.com API
    try {
        const statsPromise = fetch(`https://api.chess.com/pub/player/${username}/stats`);
        const archivesPromise = fetch(`https://api.chess.com/pub/player/${username}/games/archives`);
        const [statsRes, archivesRes] = await Promise.all([statsPromise, archivesPromise]);
        if (!statsRes.ok || !archivesRes.ok) throw new Error("Failed to fetch player data from Chess.com");
        const stats = await statsRes.json();
        const archives = await archivesRes.json();
        const latestGamesUrl = archives.archives.pop();
        if (!latestGamesUrl) return { stats, analysis: {} };
        const gamesRes = await fetch(latestGamesUrl);
        if (!gamesRes.ok) return { stats, analysis: {} };
        const gamesData = await gamesRes.json();
        const whiteOpenings = {}, blackOpenings = {};
        const usernameLower = username.toLowerCase();
        for (const game of gamesData.games) {
            if (game.rules !== 'chess') continue;
            const opening = game.pgn.match(/\[Opening "([^"]+)"\]/);
            if (!opening) continue;
            const openingName = opening[1].split(':')[0];
            if (game.white.username.toLowerCase() === usernameLower) {
                whiteOpenings[openingName] = (whiteOpenings[openingName] || 0) + 1;
            } else if (game.black.username.toLowerCase() === usernameLower) {
                blackOpenings[openingName] = (blackOpenings[openingName] || 0) + 1;
            }
        }
        const top5White = Object.entries(whiteOpenings).sort((a,b) => b[1] - a[1]).slice(0, 5).map(([name, games]) => ({ name, games }));
        const top5Black = Object.entries(blackOpenings).sort((a,b) => b[1] - a[1]).slice(0, 5).map(([name, games]) => ({ name, games }));
        return { stats, analysis: { topWhite: top5White, topBlack: top5Black } };
    } catch (error) {
        console.error("Error fetching player analysis:", error);
        return null;
    }
}

// --- UI Components ---
const SunIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>;
const MoonIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>;

function Dashboard({ currentRatings, ratingHistory, theme }) {
    const [filteredHistory, setFilteredHistory] = useState([]);
    const [selectedPlayers, setSelectedPlayers] = useState(() => FRIENDS.map(f => f.name));
    const [selectedCategory, setSelectedCategory] = useState("All");

    useEffect(() => {
        let data = ratingHistory;
        if (selectedCategory !== "All") {
            data = data.filter(h => h.category.includes(selectedCategory));
        }
        data = data.filter(h => selectedPlayers.includes(h.player_name));
        setFilteredHistory(data);
    }, [ratingHistory, selectedPlayers, selectedCategory]);

    const handlePlayerSelection = (playerName) => {
        setSelectedPlayers(prev => 
            prev.includes(playerName) ? prev.filter(p => p !== playerName) : [...prev, playerName]
        );
    };
    
    const chartColor = theme === 'dark' ? '#9ca3af' : '#9e9e9e';
    const gridColor = theme === 'dark' ? '#374151' : '#e0e0e0';

    return (
        <div>
            <h1 className="text-4xl font-bold mb-8 text-gray-800 dark:text-gray-200">Chess Rating Dashboard</h1>
            <div className="mb-10 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Current Ratings</h2>
                 <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="border-b-2 border-gray-200 dark:border-gray-700">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Player</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Rapid</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Blitz</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Bullet</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentRatings.map((player, index) => (
                                <tr key={player.friend_name} className="dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{player.friend_name}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{player.rapid_rating}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{player.blitz_rating}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{player.bullet_rating}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Rating Progression</h2>
                <div className="flex flex-wrap gap-4 mb-4 items-center">
                    <div>
                        <label className="font-semibold mr-2 text-gray-700 dark:text-gray-300">Category:</label>
                        <select onChange={(e) => setSelectedCategory(e.target.value)} value={selectedCategory} className="p-2 border rounded-md bg-white dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600">
                            <option>All</option><option>Rapid</option><option>Blitz</option><option>Bullet</option>
                        </select>
                    </div>
                    <div>
                        <label className="font-semibold mr-2 text-gray-700 dark:text-gray-300">Players:</label>
                        <div className="inline-flex flex-wrap gap-2">
                           {FRIENDS.map(friend => (
                                <button key={friend.name} onClick={() => handlePlayerSelection(friend.name)} className={`px-3 py-1 text-sm rounded-full transition-colors ${selectedPlayers.includes(friend.name) ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-600 dark:text-gray-200'}`}>
                                    {friend.name}
                                </button>
                           ))}
                        </div>
                    </div>
                </div>
                <div style={{ height: '400px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={filteredHistory}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                            <XAxis dataKey="timestamp" stroke={chartColor} />
                            <YAxis domain={['dataMin - 20', 'dataMax + 20']} stroke={chartColor} />
                            <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff', border: `1px solid ${gridColor}` }}/>
                            <Legend wrapperStyle={{ color: chartColor }} />
                            {selectedPlayers.map(player => (
                                <Line key={player} type="monotone" dataKey="rating" name={player} data={filteredHistory.filter(h => h.player_name === player)} stroke={`#${(0x1000000+Math.random()*0xffffff).toString(16).substr(1,6)}`} strokeWidth={2} connectNulls />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}

function PlayerStats({ theme }) {
    const [selectedPlayer, setSelectedPlayer] = useState(FRIENDS[0].username);
    const [playerData, setPlayerData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetchPlayerAnalysis(selectedPlayer).then(data => {
            setPlayerData(data);
            setLoading(false);
        });
    }, [selectedPlayer]);

    const chartColor = theme === 'dark' ? '#9ca3af' : '#9e9e9e';

    const OpeningChart = ({ data, color }) => (
        <div style={{height: '250px'}}>
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" stroke={chartColor} />
                    <YAxis type="category" dataKey="name" width={100} stroke={chartColor} />
                    <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff' }} />
                    <Bar dataKey="games" fill={color} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );

    const StatCard = ({title, rating, record}) => (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 text-center">
            <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400">{title}</h3>
            <p className="text-4xl font-bold text-gray-800 dark:text-gray-100 my-2">{rating || 'N/A'}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">W: {record?.win || 0} / L: {record?.loss || 0} / D: {record?.draw || 0}</p>
        </div>
    );

    return (
        <div>
            <h1 className="text-4xl font-bold mb-8 text-gray-800 dark:text-gray-200">Player Stats</h1>
            <div className="mb-8">
                 <label htmlFor="player-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select a Player</label>
                 <select id="player-select" value={selectedPlayer} onChange={e => setSelectedPlayer(e.target.value)} className="block w-full md:w-1/2 p-3 border border-gray-300 bg-white dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                    {FRIENDS.map(friend => <option key={friend.username} value={friend.username}>{friend.name}</option>)}
                </select>
            </div>
            {loading ? <p className="text-center text-gray-600 dark:text-gray-400">Loading player stats...</p> : playerData ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatCard title="Rapid" rating={playerData.stats?.chess_rapid?.last.rating} record={playerData.stats?.chess_rapid?.record} />
                        <StatCard title="Blitz" rating={playerData.stats?.chess_blitz?.last.rating} record={playerData.stats?.chess_blitz?.record} />
                        <StatCard title="Bullet" rating={playerData.stats?.chess_bullet?.last.rating} record={playerData.stats?.chess_bullet?.record} />
                    </div>
                    <div className="mt-10 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                        <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Top 5 Openings (Last Month)</h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div>
                                <h3 className="text-lg font-semibold text-center mb-2 text-gray-800 dark:text-gray-200">As White</h3>
                                <OpeningChart data={playerData.analysis.topWhite} color="#8884d8" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-center mb-2 text-gray-800 dark:text-gray-200">As Black</h3>
                                <OpeningChart data={playerData.analysis.topBlack} color="#82ca9d" />
                            </div>
                        </div>
                    </div>
                </>
            ) : <p>Could not load player data.</p>}
        </div>
    );
}

function GameAnalysis() {
    const [pgn, setPgn] = useState('');
    const [pgnError, setPgnError] = useState('');
    const [game, setGame] = useState(new Chess());
    const [history, setHistory] = useState([]);
    const [currentMove, setCurrentMove] = useState(-1);
    const [evaluation, setEvaluation] = useState('');
    const [topMoves, setTopMoves] = useState([]);
    const [engineStatus, setEngineStatus] = useState('Loading Engine...');
    const stockfish = useRef(null);

    // Using useCallback to memoize the message handler function
    const handleEngineMessage = useCallback((message, currentGame) => {
        if (message.includes('score cp')) {
            const scoreMatch = message.match(/score cp (-?\d+)/);
            if (scoreMatch) {
                setEvaluation((parseInt(scoreMatch[1], 10) / 100).toFixed(2));
            }
        }
        if (message.includes('info depth') && message.includes(' pv ')) {
            const moves = message.split(' pv ')[1].split(' ');
            const topEngineMoves = [];
            const tempGame = new Chess(currentGame.fen()); 
            for (let i = 0; i < Math.min(3, moves.length); i++) {
                try {
                    const moveResult = tempGame.move(moves[i], { sloppy: true });
                    if (moveResult) {
                        topEngineMoves.push(moveResult.san);
                        tempGame.undo();
                    }
                } catch (e) { /* ignore */ }
            }
            setTopMoves(topEngineMoves);
        }
    }, []);

    // This useEffect hook is now only for initializing and terminating the worker.
    useEffect(() => {
        stockfish.current = new Worker('/stockfish.js');
        stockfish.current.postMessage('uci');
        stockfish.current.postMessage('isready');
        stockfish.current.onmessage = (event) => {
            if (event.data === 'readyok') {
                setEngineStatus('Ready');
            } else {
                // We pass the current 'game' state to the handler
                setGame(prevGame => {
                    handleEngineMessage(event.data, prevGame);
                    return prevGame;
                });
            }
        };

        // Cleanup on component unmount
        return () => {
            stockfish.current.terminate();
        };
    }, [handleEngineMessage]);

    const getEvaluation = (fen) => {
        if (engineStatus !== 'Ready' || !stockfish.current) return;
        setEvaluation('...');
        setTopMoves([]);
        stockfish.current.postMessage(`position fen ${fen}`);
        stockfish.current.postMessage('go depth 15');
    };

    const handleLoadPgn = () => {
        setPgnError('');
        const newGame = new Chess();
        try {
            if (!newGame.loadPgn(pgn.trim())) throw new Error();
            if (newGame.history().length === 0) throw new Error("Empty PGN");
            
            setGame(newGame);
            setHistory(newGame.history({ verbose: true }));
            setCurrentMove(-1);
            getEvaluation(new Chess().fen()); // Get eval for starting position
        } catch (e) {
            setPgnError("Invalid PGN format. Please check the pasted text.");
            setGame(new Chess());
            setHistory([]);
            setCurrentMove(-1);
            setEvaluation('');
            setTopMoves([]);
        }
    };

    const navigateToMove = (index) => {
        const newGame = new Chess();
        const fullHistory = history.map(h => h.san);
        for (let i = 0; i <= index; i++) {
            newGame.move(fullHistory[i]);
        }
        setGame(newGame);
        setCurrentMove(index);
        getEvaluation(newGame.fen());
    };

    const isGameLoaded = history.length > 0;

    const EvaluationBar = ({ score }) => {
        const numScore = parseFloat(score);
        if (isNaN(numScore)) return null;
        const clampedScore = Math.max(-10, Math.min(10, numScore));
        const percentage = 50 + (clampedScore * 5);
        return (
             <div className="w-full bg-gray-700 rounded-full h-6 dark:bg-gray-800 my-2 relative overflow-hidden">
                <div className="bg-white h-6 rounded-full" style={{ width: `${percentage}%`, transition: 'width 0.3s ease-in-out' }} />
                <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-black mix-blend-difference">
                   Eval: {score}
                </div>
            </div>
        );
    };

    return (
        <div>
            <h1 className="text-4xl font-bold mb-8 text-gray-800 dark:text-gray-200">Game Analysis</h1>
            
            <div className="flex flex-col lg:flex-row gap-8 items-start">
                <div className="w-full lg:w-auto">
                    <Chessboard position={game.fen()} boardWidth={400} />
                    {isGameLoaded && <EvaluationBar score={evaluation} />}
                </div>
                <div className="w-full lg:flex-1 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                     <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-300">PGN Loader</h2>
                     <div className="flex items-center mb-2">
                        <span className="font-semibold mr-2 text-gray-700 dark:text-gray-300">Engine Status:</span>
                        <span className={`px-2 py-1 text-xs font-bold rounded-full ${engineStatus === 'Ready' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>{engineStatus}</span>
                     </div>
                     <textarea 
                        value={pgn} 
                        onChange={(e) => setPgn(e.target.value)} 
                        placeholder="Paste PGN here to load a game..." 
                        className="w-full h-32 p-2 border rounded-md bg-white dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                    />
                    {pgnError && <p className="text-red-500 text-sm mt-2">{pgnError}</p>}
                    <button 
                        onClick={handleLoadPgn}
                        disabled={engineStatus !== 'Ready'}
                        className="mt-4 w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition disabled:bg-gray-400"
                    >
                        Load Game & Analyze
                    </button>
                    {isGameLoaded && (
                         <div className="mt-6">
                             <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Top Engine Moves:</h3>
                             <ul className="list-decimal list-inside mt-2 text-gray-600 dark:text-gray-400">
                                 {topMoves.map((move, index) => <li key={index}>{move}</li>)}
                             </ul>
                         </div>
                    )}
                </div>
            </div>

            {isGameLoaded && (
                 <div className="mt-8 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Moves</h2>
                    <div className="flex flex-wrap gap-2">
                         <button onClick={() => navigateToMove(-1)} className={`px-3 py-1 text-sm rounded-md ${currentMove === -1 ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 dark:text-gray-300'}`}>Start</button>
                        {history.map((move, index) => (
                            <button key={index} onClick={() => navigateToMove(index)} className={`px-3 py-1 text-sm rounded-md ${currentMove === index ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 dark:text-gray-300'}`}>
                                {Math.floor(index/2) + 1}.{index % 2 === 0 ? '' : '..'} {move.san}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function App() {
    const [theme, setTheme] = useTheme();
    const [activeTab, setActiveTab] = useState('Dashboard');
    const [currentRatings, setCurrentRatings] = useState([]);
    const [ratingHistory, setRatingHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadAllData = async () => {
            setLoading(true);
            setError(null);
            try {
                const ratingsData = await fetchData('/ratings/current');
                const historyData = await fetchData('/ratings/history');
                if (!Array.isArray(ratingsData) || !Array.isArray(historyData)) {
                    throw new Error("Data from API is not in the expected format.");
                }
                setCurrentRatings(ratingsData);
                setRatingHistory(historyData);
            } catch (e) {
                setError("Could not connect to the backend API. Please ensure the 'api.py' server is running.");
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        loadAllData();
    }, []);

    const renderTab = () => {
        if (loading) return <div className="text-center p-10 text-gray-700 dark:text-gray-300">Loading data from backend...</div>;
        if (error) return <div className="text-center p-10 text-red-500 font-semibold">{error}</div>;
        switch (activeTab) {
            case 'Dashboard': return <Dashboard currentRatings={currentRatings} ratingHistory={ratingHistory} theme={theme} />;
            case 'Player Stats': return <PlayerStats theme={theme} />;
            case 'Game Analysis': return <GameAnalysis theme={theme} />;
            default: return <Dashboard currentRatings={currentRatings} ratingHistory={ratingHistory} theme={theme} />;
        }
    };

    const NavItem = ({ name }) => (
        <button onClick={() => setActiveTab(name)} className={`w-full text-left px-4 py-2.5 rounded-lg text-md transition-colors ${activeTab === name ? 'bg-indigo-100 dark:bg-gray-700 text-indigo-700 dark:text-gray-100 font-semibold' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-100'}`}>
            {name}
        </button>
    );
    
    const toggleTheme = () => setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');

    return (
        <div className="flex h-screen bg-gray-100 dark:bg-gray-900 font-sans">
            <aside className="w-64 bg-white dark:bg-gray-800 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">♟️ Chess App</h1>
                </div>
                <nav className="p-4 space-y-2 flex-grow">
                    <NavItem name="Dashboard" />
                    <NavItem name="Player Stats" />
                    <NavItem name="Game Analysis" />
                </nav>
                 <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                    <button onClick={toggleTheme} className="w-full flex items-center justify-center p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                       {theme === 'light' ? <MoonIcon /> : <SunIcon />}
                       <span className="ml-2">Switch Theme</span>
                    </button>
                </div>
            </aside>
            <main className="flex-1 overflow-y-auto p-8">
                {renderTab()}
            </main>
        </div>
    );
}
