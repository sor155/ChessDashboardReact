import React, { useState, useEffect, useRef } from 'react';
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

const MANUAL_INITIAL_RATINGS = {
    "realulysse": { "Rapid": 1971, "Blitz": 1491, "Bullet": 1349 },
    "poulet_tao": { "Rapid": 1006, "Blitz": 413, "Bullet": 716 },
    "adrienbourque": { "Rapid": 1619, "Blitz": 1163, "Bullet": 747 },
    "naatiry": { "Rapid": 874, "Blitz": 315, "Bullet": 487 },
    "kevor24": { "Rapid": 702, "Blitz": 846, "Bullet": 577 }
};

let ecoDataPromise = null;
async function getEcoData() {
    if (ecoDataPromise) return ecoDataPromise;

    const cacheKey = 'lichessEcoTsv';
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }

    ecoDataPromise = fetch('https://raw.githubusercontent.com/lichess-org/chess-openings/master/dist/eco.tsv')
        .then(res => res.text())
        .then(text => {
            const lines = text.split('\n').slice(1); // skip header
            const ecoMap = {};
            lines.forEach(line => {
                const [, name, , fen] = line.split('\t');
                if (fen) {
                    const fenKey = fen.split(' ')[0];
                    if (!ecoMap[fenKey]) {
                       ecoMap[fenKey] = name;
                    }
                }
            });
            localStorage.setItem(cacheKey, JSON.stringify(ecoMap));
            return ecoMap;
        });
    return ecoDataPromise;
}

async function getOpeningFromEco(pgn, ecoMap) {
    const chess = new Chess();
    // Pre-clean the PGN to remove common annotations that cause parsing issues
    const cleanedPgn = pgn
        .replace(/\[%clk [^\]]*\]/g, '') 
        .replace(/\[%eval [^\]]*\]/g, '')
        .trim();
        
    try {
        chess.loadPgn(cleanedPgn, { sloppy: true });
    } catch (e) {
        console.warn("Could not parse PGN, skipping game.", e);
        return 'Invalid PGN';
    }

    const headers = chess.header();

    if (headers.ECOUrl) {
        try {
            const urlParts = headers.ECOUrl.split('/');
            const openingSlug = urlParts[urlParts.length - 1];
            return decodeURIComponent(openingSlug).replace(/-/g, ' ');
        } catch (e) {
             // Fallback
        }
    }

    if (headers.Opening && headers.Opening !== '?' && !headers.Opening.toLowerCase().includes('custom')) {
        return headers.Opening.split(':')[0].trim();
    }
    
    const history = chess.history({ verbose: true });
    // Use the starting FEN from the game header, or default to standard start
    const startingFen = headers.FEN || new Chess().fen();
    const game = new Chess(startingFen);

    for (let i = 0; i < Math.min(history.length, 20); i++) { 
        game.move(history[i].san);
        const fenKey = game.fen().split(' ')[0];
        if (ecoMap[fenKey]) {
            return ecoMap[fenKey].split(':')[0].trim();
        }
    }

    return 'Unknown Opening';
}


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
    const cacheKey = `playerAnalysis_${username}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const isCacheValid = (new Date() - new Date(timestamp)) < 24 * 60 * 60 * 1000; // 24-hour cache
        if (isCacheValid) {
            console.log(`Using cached data for ${username}`);
            return data;
        }
    }

    console.log(`Fetching new data for ${username}`);
    try {
        const ecoMap = await getEcoData();
        const statsPromise = fetch(`https://api.chess.com/pub/player/${username}/stats`);
        const archivesPromise = fetch(`https://api.chess.com/pub/player/${username}/games/archives`);

        const [statsRes, archivesRes] = await Promise.all([statsPromise, archivesPromise]);

        if (!statsRes.ok || !archivesRes.ok) {
            throw new Error("Failed to fetch player data from Chess.com");
        }

        const stats = await statsRes.json();
        const archives = await archivesRes.json();
        const allArchiveUrls = archives.archives;

        const lastFourMonthsUrls = [];
        const today = new Date();
        for (let i = 0; i < 4; i++) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const year = d.getFullYear();
            const month = (d.getMonth() + 1).toString().padStart(2, '0');
            lastFourMonthsUrls.push(`https://api.chess.com/pub/player/${username}/games/${year}/${month}`);
        }
        
        const archivesToFetch = allArchiveUrls.filter(url => lastFourMonthsUrls.includes(url));
        
        const allGames = [];
        if (archivesToFetch.length > 0) {
            const archivePromises = archivesToFetch.map(url => fetch(url).then(res => res.json()));
            const monthlyGamesArrays = await Promise.all(archivePromises);
            monthlyGamesArrays.forEach(month => allGames.push(...month.games));
        }

        const whiteOpenings = {};
        const blackOpenings = {};
        let whiteAccuracySum = 0;
        let whiteGamesCount = 0;
        let blackAccuracySum = 0;
        let blackGamesCount = 0;
        const usernameLower = username.toLowerCase();
        
        for (const game of allGames) {
            if (game.rules !== 'chess') continue;
            
            const opening = await getOpeningFromEco(game.pgn, ecoMap);
            const isWhite = game.white.username.toLowerCase() === usernameLower;
            const isBlack = game.black.username.toLowerCase() === usernameLower;

            if (isWhite) {
                whiteOpenings[opening] = (whiteOpenings[opening] || 0) + 1;
            } else if (isBlack) {
                blackOpenings[opening] = (blackOpenings[opening] || 0) + 1;
            }
            
            if (game.accuracies) {
                if (isWhite && game.accuracies.white) {
                    whiteAccuracySum += game.accuracies.white;
                    whiteGamesCount++;
                } else if (isBlack && game.accuracies.black) {
                    blackAccuracySum += game.accuracies.black;
                    blackGamesCount++;
                }
            }
        }

        const topWhite = Object.entries(whiteOpenings).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, games]) => ({ name, games }));
        const topBlack = Object.entries(blackOpenings).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, games]) => ({ name, games }));
        
        const avgWhiteAccuracy = whiteGamesCount > 0 ? (whiteAccuracySum / whiteGamesCount).toFixed(1) : null;
        const avgBlackAccuracy = blackGamesCount > 0 ? (blackAccuracySum / blackGamesCount).toFixed(1) : null;

        const result = { stats, analysis: { topWhite, topBlack, avgWhiteAccuracy, avgBlackAccuracy } };
        
        localStorage.setItem(cacheKey, JSON.stringify({ data: result, timestamp: new Date() }));
        
        return result;
    } catch (error) {
        console.error("Error fetching player analysis:", error);
        return null;
    }
}


// --- UI Components ---
const SunIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>;
const MoonIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>;

function Dashboard({ currentRatings, ratingHistory, theme }) {
    const [chartData, setChartData] = useState([]);
    const [selectedPlayers, setSelectedPlayers] = useState(() => FRIENDS.map(f => f.name));
    const [selectedCategory, setSelectedCategory] = useState("Rapid");

    useEffect(() => {
        const dataByCategory = ratingHistory.filter(h => h.category.includes(selectedCategory));

        const playerSeries = selectedPlayers.map(player => {
            return dataByCategory
                .filter(h => h.player_name === player)
                .map(h => ({
                    date: new Date(h.timestamp).getTime(),
                    rating: h.rating,
                    player: player
                }))
                .sort((a, b) => a.date - b.date);
        });

        const allDates = [...new Set(dataByCategory.map(h => new Date(h.timestamp).getTime()))].sort((a,b) => a - b);

        const processedData = allDates.map(date => {
            const dateStr = new Date(date).toLocaleDateString();
            const dataPoint = { date: dateStr };
            playerSeries.forEach(series => {
                if(series.length > 0) {
                     const playerName = series[0].player;
                     const pointForDate = series.find(p => new Date(p.date).toLocaleDateString() === dateStr);
                     dataPoint[playerName] = pointForDate ? pointForDate.rating : null;
                }
            });
            return dataPoint;
        });

        // Forward fill nulls to create continuous lines
        for (let i = 1; i < processedData.length; i++) {
            for (const player of selectedPlayers) {
                if (processedData[i][player] === null || processedData[i][player] === undefined) {
                    processedData[i][player] = processedData[i - 1][player];
                }
            }
        }
        
        setChartData(processedData);

    }, [ratingHistory, selectedPlayers, selectedCategory]);

    const handlePlayerSelection = (playerName) => {
        setSelectedPlayers(prev =>
            prev.includes(playerName) ? prev.filter(p => p !== playerName) : [...prev, playerName]
        );
    };
    
    const chartColor = theme === 'dark' ? '#9ca3af' : '#9e9e9e';
    const gridColor = theme === 'dark' ? '#374151' : '#e0e0e0';
    const playerColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE'];

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
                            {currentRatings.map((player) => (
                                <tr key={player.friend_name} className="dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{player.friend_name}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                        {player.rapid_rating}
                                        <span className={player.rapid_change >= 0 ? 'text-green-500' : 'text-red-500'}>
                                            ({player.rapid_change >= 0 ? '+' : ''}{player.rapid_change})
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                        {player.blitz_rating}
                                        <span className={player.blitz_change >= 0 ? 'text-green-500' : 'text-red-500'}>
                                            ({player.blitz_change >= 0 ? '+' : ''}{player.blitz_change})
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                        {player.bullet_rating}
                                        <span className={player.bullet_change >= 0 ? 'text-green-500' : 'text-red-500'}>
                                            ({player.bullet_change >= 0 ? '+' : ''}{player.bullet_change})
                                        </span>
                                    </td>
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
                            <option>Rapid</option>
                            <option>Blitz</option>
                            <option>Bullet</option>
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
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                            <XAxis dataKey="date" stroke={chartColor} />
                            <YAxis domain={['dataMin - 20', 'dataMax + 20']} stroke={chartColor} />
                            <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff', border: `1px solid ${gridColor}` }}/>
                            <Legend wrapperStyle={{ color: chartColor }} />
                            {FRIENDS.map((friend, index) => (
                                selectedPlayers.includes(friend.name) && <Line key={friend.name} type="monotone" dataKey={friend.name} stroke={playerColors[index % playerColors.length]} strokeWidth={2} connectNulls />
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

    const OpeningChart = ({ data, color }) => {
        if (!data || data.length === 0) {
            return <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">No opening data available.</div>;
        }
        return (
            <div style={{height: '250px'}}>
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 120, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" stroke={chartColor} />
                        <YAxis type="category" dataKey="name" width={120} stroke={chartColor} tick={{fontSize: 12}} />
                        <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff' }} />
                        <Bar dataKey="games" fill={color} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        );
    }

    const StatCard = ({title, rating, record}) => (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 text-center">
            <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400">{title}</h3>
            <p className="text-4xl font-bold text-gray-800 dark:text-gray-100 my-2">{rating || 'N/A'}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">W: {record?.win || 0} / L: {record?.loss || 0} / D: {record?.draw || 0}</p>
        </div>
    );

    const AccuracyCard = ({ title, accuracy }) => (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 text-center">
            <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400">{title}</h3>
            <p className="text-4xl font-bold text-gray-800 dark:text-gray-100 my-2">{accuracy ? `${accuracy}%` : 'N/A'}</p>
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
            {loading ? <p className="text-center text-gray-600 dark:text-gray-400">Fetching player game archives... This may take a moment.</p> : playerData ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatCard title="Rapid" rating={playerData.stats?.chess_rapid?.last.rating} record={playerData.stats?.chess_rapid?.record} />
                        <StatCard title="Blitz" rating={playerData.stats?.chess_blitz?.last.rating} record={playerData.stats?.chess_blitz?.record} />
                        <StatCard title="Bullet" rating={playerData.stats?.chess_bullet?.last.rating} record={playerData.stats?.chess_bullet?.record} />
                    </div>
                     <div className="mt-10 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                        <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Average Accuracy (Last 4 Months)</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <AccuracyCard title="As White" accuracy={playerData.analysis.avgWhiteAccuracy} />
                            <AccuracyCard title="As Black" accuracy={playerData.analysis.avgBlackAccuracy} />
                        </div>
                    </div>
                    <div className="mt-10 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                        <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Favorite Openings (Last 4 Months)</h2>
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
    const [engineStatus, setEngineStatus] = useState('Loading...');
    const stockfish = useRef(null);
    const currentGameForEngine = useRef(new Chess());

    // This effect runs only once to initialize the engine
    useEffect(() => {
        // Use the exact filename you provided
        const STOCKFISH_URL = '/stockfish-17-lite-single.js';

        const worker = new Worker(STOCKFISH_URL);
        stockfish.current = worker;

        const onMessage = (event) => {
            const message = String(event.data);

            if (message === 'readyok') {
                setEngineStatus('Ready');
            } else if (message.startsWith('uciok')) {
                // Sent after 'uci' command, now we can send 'isready'
                worker.postMessage('isready');
            } else {
                 if (message.includes('score cp')) {
                    const scoreMatch = message.match(/score cp (-?\d+)/);
                    if (scoreMatch) {
                        setEvaluation((parseInt(scoreMatch[1], 10) / 100).toFixed(2));
                    }
                }
                if (message.includes('info depth') && message.includes(' pv ')) {
                    const moves = message.split(' pv ')[1].split(' ');
                    const topEngineMoves = [];
                    const tempGame = new Chess(currentGameForEngine.current.fen());
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
            }
        };

        worker.addEventListener('message', onMessage);

        worker.onerror = (e) => {
             setEngineStatus(`Error: Could not load ${STOCKFISH_URL}. Make sure it and the corresponding .wasm file are in the /public folder.`);
             console.error("Stockfish worker error:", e);
        };

        // Start the initialization process
        worker.postMessage('uci');

        return () => {
            worker.removeEventListener('message', onMessage);
            worker.terminate();
        };
    }, []);

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
            let pgnString = pgn.trim();

            // 1. Extract all PGN tags using a regular expression.
            const tagRegex = /\[\s*(\w+)\s*"([^"]*)"\s*\]/g;
            const tags = pgnString.match(tagRegex) || [];

            // 2. Isolate the movetext by removing the tags from the original string.
            const movetext = pgnString.replace(tagRegex, '').trim();

            // 3. Aggressively clean ONLY the movetext part.
            const cleanedMovetext = movetext
                .replace(/\{[^}]*?\}/g, '')      // Remove comments like { [%eval ...] } or simple comments
                .replace(/\([^)]*?\)/g, '')       // Remove recursive annotation variations ( ... )
                .replace(/\$\d+/g, '')          // Remove numeric annotation glyphs (NAGs) like $1
                .replace(/[\r\n\t]+/g, ' ')   // Normalize all whitespace (newlines, tabs) to single spaces
                .trim();

            // 4. Reconstruct the PGN in a standard, clean format.
            const cleanedPgn = tags.join('\n') + '\n\n' + cleanedMovetext;

            // 5. Load the reconstructed PGN into the chess.js instance.
            newGame.loadPgn(cleanedPgn);

            if (newGame.history().length === 0) {
                throw new Error("The PGN was loaded, but it contains no moves.");
            }

            // 6. Success: Update the application state with the new game.
            const startingFen = new Chess().fen();
            setGame(new Chess(startingFen));
            currentGameForEngine.current = new Chess(startingFen);
            setHistory(newGame.history({ verbose: true }));
            setCurrentMove(-1);
            getEvaluation(startingFen);

        } catch (e) {
            // If any step fails, catch the error and display it to the user.
            setPgnError(e.message || "An unexpected error occurred while loading the PGN.");
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
        currentGameForEngine.current = new Chess(newGame.fen());
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

                const friendUsernameMap = FRIENDS.reduce((acc, curr) => {
                    acc[curr.name] = curr.username;
                    return acc;
                }, {});

                const ratingsWithChanges = ratingsData.map(player => {
                    const username = friendUsernameMap[player.friend_name];
                    const initialRatings = MANUAL_INITIAL_RATINGS[username];

                    const rapid_change = initialRatings ? player.rapid_rating - initialRatings.Rapid : 0;
                    const blitz_change = initialRatings ? player.blitz_rating - initialRatings.Blitz : 0;
                    const bullet_change = initialRatings ? player.bullet_rating - initialRatings.Bullet : 0;
                    
                    return {
                        ...player,
                        rapid_change,
                        blitz_change,
                        bullet_change
                    };
                });

                setCurrentRatings(ratingsWithChanges);
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
