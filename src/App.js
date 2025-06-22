import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';


// --- Constants ---
const FRIENDS = [
    { name: "Ulysse", username: "realulysse" },
    { name: "Simon", username: "poulet_tao" },
    { name: "Adrien", username: "adrienbourque" },
    { name: "Alex", username: "naatiry" },
    { name: "Kevin", username: "kevor24" }, // Fixed: changed '=' to ':'
];

const MANUAL_INITIAL_RATINGS = {
    "realulysse": { "Rapid": 1971, "Blitz": 1491, "Bullet": 1349 },
    "poulet_tao": { "Rapid": 1006, "Blitz": 413, "Bullet": 716 },
    "adrienbourque": { "Rapid": 1619, "Blitz": 1163, "Bullet": 747 },
    "naatiry": { "Rapid": 874, "Blitz": 315, "Bullet": 487 },
    "kevor24": { "Rapid": 702, "Blitz": 846, "Bullet": 577 }
};

// --- Theme and Utility Hooks ---
const useTheme = () => {
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove(theme === 'light' ? 'dark' : 'light');
        root.classList.add(theme);
        localStorage.setItem('theme', theme);
    }, [theme]);
    return [theme, setTheme];
};

// --- API & Data Fetching ---
async function fetchData(endpoint) {
    try {
        const response = await fetch(`/api${endpoint}`);
        if (!response.ok) throw new Error(`Network response was not ok for ${endpoint}`);
        return await response.json();
    } catch (error) {
        console.error(`Failed to fetch ${endpoint}:`, error);
        return [];
    }
}

// --- UI Components ---
const SunIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>;
const MoonIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>;

// Arrow icons for navigation
const FaArrowLeft = () => <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 256 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M192 448c-8.188 0-16.38-3.125-22.62-9.375l-160-160c-12.5-12.5-12.5-32.75 0-45.25l160-160c12.5-12.5 32.75-12.5 45.25 0s12.5 32.75 0 45.25L77.25 256l137.4 137.4c12.5 12.5 12.5 32.75 0 45.25C208.4 444.9 200.2 448 192 448z"></path></svg>;
const FaArrowRight = () => <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 256 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M64 448c-8.188 0-16.38-3.125-22.62-9.375c-12.5-12.5-12.5-32.75 0-45.25L178.8 256L41.38 118.6c-12.5-12.5-12.5-32.75 0-45.25s32.75-12.5 45.25 0l160 160c12.5 12.5 12.5 32.75 0 45.25l-160 160C80.38 444.9 72.19 448 64 448z"></path></svg>;

// Hamburger Menu Icon
const MenuIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
);

// Close Icon for Menu
const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);


function Dashboard({ currentRatings, ratingHistory, theme }) {
    const [chartData, setChartData] = useState([]);
    const [selectedPlayers, setSelectedPlayers] = useState(() => FRIENDS.map(f => f.name));
    const [selectedCategory, setSelectedCategory] = useState("Rapid");

    useEffect(() => {
        const dataByCategory = ratingHistory.filter(h => h.category.toLowerCase().includes(selectedCategory.toLowerCase()));

        const playerSeries = selectedPlayers.map(player => {
            return dataByCategory
                .filter(h => h.player_name === player)
                .map(h => ({
                    date: new Date(h.date).getTime(),
                    rating: h.rating,
                    player: player
                }))
                .sort((a, b) => a.date - b.date);
        });

        const allDates = [...new Set(dataByCategory.map(h => new Date(h.date).toLocaleDateString()))].sort((a, b) => new Date(a) - new Date(b));

        const processedData = allDates.map(dateStr => {
            const dataPoint = { date: dateStr };
            playerSeries.forEach(series => {
                if (series.length > 0) {
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
                            <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff', border: `1px solid ${gridColor}` }} />
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

function PlayerStats({ theme, openingStats: allOpeningStats }) {
    const [selectedPlayer, setSelectedPlayer] = useState(FRIENDS[0].username);
    const [playerData, setPlayerData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAllPlayerData = async () => {
            setLoading(true);
            try {
                const stats = await fetch(`https://api.chess.com/pub/player/${selectedPlayer}/stats`).then(res => res.json());

                setPlayerData({ stats });
            } catch (error) {
                console.error("Failed to fetch player data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAllPlayerData();
    }, [selectedPlayer, allOpeningStats]);

    const chartColor = theme === 'dark' ? '#9ca3af' : '#9e9e9e';

    const OpeningChart = ({ data, color, title }) => {
        if (!data || data.length === 0) {
            return (
                <div>
                    <h3 className="text-lg font-semibold text-center mb-2 text-gray-800 dark:text-gray-200">{title}</h3>
                    <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">No opening data available.</div>
                </div>
            );
        }
        return (
            <div>
                <h3 className="text-lg font-semibold text-center mb-2 text-gray-800 dark:text-gray-200">{title}</h3>
                {/* Added explicit height to the parent div for ResponsiveContainer */}
                <div style={{ height: '250px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={data}
                            layout="vertical"
                            margin={{
                                top: 5,
                                right: 20,
                                left: window.innerWidth < 768 ? 60 : 120, // Responsive left margin
                                bottom: 5
                            }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" dataKey="games_played" stroke={chartColor} />
                            <YAxis type="category" dataKey="opening_name" width={120} stroke={chartColor} tick={{ fontSize: 12 }} />
                            <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff' }} formatter={(value, name, props) => {
                                if (name === "games_played") {
                                    const { white_wins, draws } = props.payload;
                                    return `${value} (W: ${white_wins}, L: ${props.payload.losses}, D: ${draws})`;
                                }
                                return value;
                            }} />
                            <Bar dataKey="games_played" fill={color} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    }

    const StatCard = ({ title, rating, record }) => (
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
            {loading ? <p className="text-center text-gray-600 dark:text-gray-400">Loading player data...</p> : playerData ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatCard title="Rapid" rating={playerData.stats?.chess_rapid?.last.rating} record={playerData.stats?.chess_rapid?.record} />
                        <StatCard title="Blitz" rating={playerData.stats?.chess_blitz?.last.rating} record={playerData.stats?.chess_blitz?.record} />
                        <StatCard title="Bullet" rating={playerData.stats?.chess_bullet?.last.rating} record={playerData.stats?.chess_bullet?.record} />
                    </div>
                    <div className="mt-10 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                        <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Favorite Openings</h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <OpeningChart title="As White" data={allOpeningStats.filter(s => s.player === FRIENDS.find(f => f.username === selectedPlayer)?.name && s.color === 'white')} color="#8884d8" />
                            <OpeningChart title="As Black" data={allOpeningStats.filter(s => s.player === FRIENDS.find(f => f.username === selectedPlayer)?.name && s.color === 'black')} color="#82ca9d" />
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
    const [currentMove, setCurrentMove] = useState(-1); // -1 for initial position
    const [evaluation, setEvaluation] = useState('');
    const [topMoves, setTopMoves] = useState([]);
    const [engineStatus, setEngineStatus] = useState('Loading...');
    const stockfish = useRef(null);
    const currentGameForEngine = useRef(new Chess());

    // Memoize getEvaluation to prevent it from changing on every render
    const getEvaluation = useCallback((fen) => {
        if (engineStatus !== 'Ready' || !stockfish.current) {
            console.log("getEvaluation: Engine not ready or worker not available.");
            return;
        }
        setEvaluation('...'); // Show loading state for evaluation
        setTopMoves([]);      // Clear previous top moves
        console.log(`getEvaluation: Requesting evaluation for FEN: ${fen}`);
        stockfish.current.postMessage(`position fen ${fen}`);
        stockfish.current.postMessage('go depth 15'); // Request evaluation up to depth 15
    }, [engineStatus]); // Add engineStatus to dependencies

    useEffect(() => {
        const STOCKFISH_URL = process.env.PUBLIC_URL + '/stockfish-17-lite-single.js';

        let worker;
        try {
            worker = new Worker(STOCKFISH_URL);
            stockfish.current = worker;

            const onMessage = (event) => {
                const message = String(event.data);
                console.log("Stockfish message:", message); // Log all messages

                if (message === 'readyok') {
                    setEngineStatus('Ready');
                    console.log("Stockfish is Ready.");
                } else if (message.startsWith('uciok')) {
                    worker.postMessage('isready');
                } else {
                    if (message.includes('score cp')) {
                        const scoreMatch = message.match(/score cp (-?\d+)/);
                        if (scoreMatch) {
                            // Convert centipawns to pawn evaluation
                            const newEval = (parseInt(scoreMatch[1], 10) / 100).toFixed(2);
                            setEvaluation(newEval);
                            console.log("Evaluation updated to:", newEval);
                        }
                    } else if (message.includes('info depth') && message.includes(' pv ')) {
                        console.log("PV message received:", message);
                        const moves = message.split(' pv ')[1].split(' ');
                        const topEngineMoves = [];
                        const tempGame = new Chess(currentGameForEngine.current.fen());
                        console.log("Current board (FEN) for engine parsing:", currentGameForEngine.current.fen());
                        console.log("Raw engine PV moves:", moves);

                        // Process up to 5 top moves
                        for (let i = 0; i < Math.min(5, moves.length); i++) { // Changed from 3 to 5
                            console.log(`Attempting to process move ${i + 1}: ${moves[i]} on FEN: ${tempGame.fen()}`);
                            try {
                                const moveResult = tempGame.move(moves[i]);
                                console.log(`Result of tempGame.move(${moves[i]}):`, moveResult);
                                if (moveResult) {
                                    topEngineMoves.push(moveResult.san);
                                    tempGame.undo(); // Undo the move to find next top move from same position
                                    console.log(`Processed move: ${moveResult.san}. Temp game FEN after undo: ${tempGame.fen()}`);
                                } else {
                                    console.log(`Move ${moves[i]} was illegal or could not be parsed by chess.js for FEN: ${tempGame.fen()}`);
                                }
                            } catch (e) {
                                console.error("Error processing engine move:", moves[i], e);
                            }
                        }
                        setTopMoves(topEngineMoves);
                        console.log("Top moves set to:", topEngineMoves);
                    }
                }
            };

            worker.addEventListener('message', onMessage);

            worker.onerror = (e) => {
                 setEngineStatus(`Error: Could not load Stockfish. Make sure stockfish-17-lite-single.js and .wasm are in /public.`);
                 console.error("Stockfish worker error:", e);
            };

            worker.postMessage('uci'); // Initialize UCI protocol

            return () => {
                worker.removeEventListener('message', onMessage);
                worker.terminate();
            };
        } catch (error) {
            setEngineStatus('Failed to load worker.');
            console.error("Failed to initialize Stockfish worker:", error);
        }
    }, []); // Empty dependency array means this runs once on mount


    const handleLoadPgn = () => {
        setPgnError('');
        const newGame = new Chess();
        try {
            let pgnString = pgn.trim();
            // Regular expression to find PGN tags like [Event "Casual Game"]
            const tagRegex = /\[\s*(\w+)\s*"([^"]*)"\s*\]/g;
            const tags = pgnString.match(tagRegex) || [];
            // Remove tags and comments/variations to get clean movetext
            const movetext = pgnString.replace(tagRegex, '').trim();
            const cleanedMovetext = movetext
                .replace(/\{[^}]*?\}/g, '') // Remove comments in curly braces
                .replace(/\([^)]*?\)/g, '') // Remove variations in parentheses
                .replace(/\$\d+/g, '')       // Remove numeric annotation glyphs
                .replace(/[\r\n\t]+/g, ' ')  // Replace newlines/tabs with spaces
                .trim();

            // Reconstruct PGN with cleaned movetext for loading
            const cleanedPgn = tags.join('\n') + '\n\n' + cleanedMovetext;
            newGame.loadPgn(cleanedPgn);

            if (newGame.history().length === 0) {
                throw new Error("The PGN was loaded, but it contains no moves.");
            }
            // Reset to initial board state for analysis
            const startingFen = new Chess().fen();
            setGame(new Chess(startingFen));
            currentGameForEngine.current = new Chess(startingFen); // Keep engine game state separate
            setHistory(newGame.history({ verbose: true })); // Store verbose history for SAN and other data
            setCurrentMove(-1); // Go to initial position
            getEvaluation(startingFen); // Get evaluation for starting position

        } catch (e) {
            setPgnError(e.message || "An unexpected error occurred while loading the PGN.");
            // Reset state on error
            setGame(new Chess());
            setHistory([]);
            setCurrentMove(-1);
            setEvaluation('');
            setTopMoves([]);
        }
    };

    const navigateToMove = useCallback((index) => {
        const tempGame = new Chess();
        const fullHistory = history.map(h => h.san); // Get SAN for all moves
        // Apply moves up to the target index
        for (let i = 0; i <= index; i++) {
            if (fullHistory[i]) {
                tempGame.move(fullHistory[i]);
            }
        }
        setGame(tempGame); // Update chessboard
        currentGameForEngine.current = new Chess(tempGame.fen()); // Update engine's game state
        setCurrentMove(index); // Set current move index
        getEvaluation(tempGame.fen()); // Get evaluation for the new position
    }, [history, getEvaluation]); // Depend on history and getEvaluation

    // Handlers for arrow navigation
    const goToPreviousMove = useCallback(() => {
        if (currentMove > -1) {
            navigateToMove(currentMove - 1);
        }
    }, [currentMove, navigateToMove]);

    const goToNextMove = useCallback(() => {
        if (currentMove < history.length - 1) {
            navigateToMove(currentMove + 1);
        }
    }, [currentMove, history.length, navigateToMove]);

    const isGameLoaded = history.length > 0;

    const EvaluationBar = ({ score }) => {
        const numScore = parseFloat(score);
        // Handle '...' loading state or invalid scores
        if (isNaN(numScore)) {
            return (
                <div className="w-full bg-gray-700 rounded-full h-6 dark:bg-gray-800 my-2 relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-300">
                        Eval: {score}
                    </div>
                </div>
            );
        }
        // Clamp score for visualization, e.g., between -10 and 10 pawns
        const clampedScore = Math.max(-10, Math.min(10, numScore));
        // Calculate percentage for white's advantage (50% is even, >50% white, <50% black)
        const percentage = 50 + (clampedScore * 5); // Each pawn is 5%

        // Determine background color based on advantage
        const barColor = numScore >= 0 ? 'bg-white' : 'bg-gray-800 dark:bg-gray-200'; // White for positive/neutral, a darker color for black advantage

        return (
            <div className="w-full bg-gray-700 rounded-full h-6 dark:bg-gray-800 my-2 relative overflow-hidden">
                <div className={`${barColor} h-full absolute top-0 left-0 transition-width duration-300 ease-in-out`} style={{ width: `${percentage}%` }} />
                 <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-black dark:text-white mix-blend-difference">
                    Eval: {score}
                </div>
            </div>
        );
    };

    return (
        <div>
            <h1 className="text-4xl font-bold mb-8 text-gray-800 dark:text-gray-200">Chess Analysis</h1>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
                <div className="w-full lg:w-auto">
                    {/* Dynamic chessboard width */}
                    <Chessboard position={game.fen()} boardWidth={Math.min(400, window.innerWidth * 0.9)} />
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
                    <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Navigate Moves</h2>
                    <div className="flex justify-center gap-4">
                        <button
                            onClick={goToPreviousMove}
                            disabled={currentMove <= -1} // Disable if at start position or before
                            className="p-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                            aria-label="Previous move"
                        >
                            <FaArrowLeft />
                        </button>
                        <button
                            onClick={goToNextMove}
                            disabled={currentMove >= history.length - 1} // Disable if at last move
                            className="p-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                            aria-label="Next move"
                        >
                            <FaArrowRight />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// Renamed the main App component to InternalApp
function InternalApp() {
    const [theme, setTheme] = useTheme();
    const [activeTab, setActiveTab] = useState('Dashboard');
    const [currentRatings, setCurrentRatings] = useState([]);
    const [ratingHistory, setRatingHistory] = useState([]);
    const [openingStats, setOpeningStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // State for mobile menu visibility

    const loadAllData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const ratingsData = await fetchData('/current-ratings');
            const historyData = await fetchData('/rating-history');
            const openingsData = await fetchData('/opening-stats');

            if (!Array.isArray(ratingsData) || !Array.isArray(historyData) || !Array.isArray(openingsData)) {
                throw new Error("Data from API is not in the expected format.");
            }

            const friendUsernameMap = FRIENDS.reduce((acc, curr) => {
                acc[curr.name] = curr.username;
                return acc;
            }, {});

            const ratingsWithChanges = ratingsData.map(player => {
                const username = friendUsernameMap[player.player];
                const initialRatings = MANUAL_INITIAL_RATINGS[username];

                const rapid_change = initialRatings ? player.rapid - initialRatings.Rapid : 0;
                const blitz_change = initialRatings ? player.blitz - initialRatings.Blitz : 0;
                const bullet_change = initialRatings ? player.bullet - initialRatings.Bullet : 0;

                return {
                    ...player,
                    friend_name: player.player,
                    rapid_rating: player.rapid,
                    blitz_rating: player.blitz,
                    bullet_rating: player.bullet,
                    rapid_change,
                    blitz_change,
                    bullet_change
                };
            });

            const historyWithPlayerNames = historyData.map(h => ({...h, player_name: h.player}));

            setCurrentRatings(ratingsWithChanges);
            setRatingHistory(historyWithPlayerNames);
            setOpeningStats(openingsData);
        } catch (e) {
            setError("Could not connect to the backend API. Please ensure the 'api.py' server is running.");
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAllData();
    }, [loadAllData]);

    const renderTab = () => {
        if (loading) return <div className="text-center p-10 text-gray-700 dark:text-gray-300">Loading data from backend...</div>;
        if (error) return <div className="text-center p-10 text-red-500 font-semibold">{error}</div>;
        switch (activeTab) {
            case 'Dashboard': return <Dashboard currentRatings={currentRatings} ratingHistory={ratingHistory} theme={theme} />;
            case 'Player Stats': return <PlayerStats friends={FRIENDS} theme={theme} openingStats={openingStats} />;
            case 'Game Analysis': return <GameAnalysis theme={theme} />;
            default: return <Dashboard currentRatings={currentRatings} ratingHistory={ratingHistory} theme={theme} />;
        }
    };

    // NavItem now also closes the mobile menu
    const NavItem = ({ name }) => (
        <button onClick={() => { setActiveTab(name); setIsMobileMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 rounded-lg text-md transition-colors ${activeTab === name ? 'bg-indigo-100 dark:bg-gray-700 text-indigo-700 dark:text-gray-100 font-semibold' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-100'}`}>
            {name}
        </button>
    );

    const toggleMobileMenu = () => setIsMobileMenuOpen(prev => !prev);
    // Wrapped toggleTheme in useCallback
    const toggleTheme = useCallback(() => {
        setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
    }, [setTheme]);


    return (
        <div className="relative min-h-screen bg-gray-100 dark:bg-gray-900 font-sans">
            {/* Universal Header - fixed to top-left corner */}
            <header className="fixed top-0 left-0 z-50 bg-white dark:bg-gray-800 p-3 shadow-md flex items-center justify-between w-40"> {/* Smaller fixed width */}
                <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap overflow-hidden text-ellipsis">♟️ Chess App</h1> {/* Keep title visible, maybe truncate */}
                <button onClick={toggleMobileMenu} className="p-1 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                    <MenuIcon />
                </button>
            </header>

            {/* Universal Menu Overlay */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-40" onClick={() => setIsMobileMenuOpen(false)}> {/* Z-index lower than header */}
                    {/* The actual sliding menu panel */}
                    <div className={`absolute left-0 top-0 h-full w-32 bg-white dark:bg-gray-800 flex flex-col shadow-lg transform transition-transform duration-300 ease-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`} onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">Menu</h1>
                            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                                <CloseIcon />
                            </button>
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
                    </div>
                </div>
            )}

     {/* Main Content */}
            {/* Adjusted padding for main content based on header size and screen size */}
            <main className="flex-1 overflow-y-auto p-8 pt-16 pl-8 lg:pl-48"> {/* Default pl-8 for mobile, pl-48 for larger screens */}
                {renderTab()}
            </main>
        </div>
    );
}

// New default export App component that includes SpeedInsights
export default function App() {
    return (
        <>
            <InternalApp />
            {/* SpeedInsights component is commented out as it caused compilation issues in this environment.
                For local development/deployment, you would uncomment it and ensure the package is installed. */}
             {/* <SpeedInsights /> */}
            {/* Analytics component is commented out as it requires installation.
                For local development/deployment, uncomment it and ensure the package is installed. */}
             {/* <Analytics /> */}
        </>
    );
}
