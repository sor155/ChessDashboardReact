import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

// Vercel Speed Insights and Analytics require installation via npm/yarn.
// They are commented out in this environment to allow the application to compile.
// In a real project/deployment, you would first install them using:
// `npm install @vercel/speed-insights @vercel/analytics`
// or `yarn add @vercel/speed-insights @vercel/analytics`
// After successful installation, uncomment the lines below and in the App component.
// import { SpeedInsights } from '@vercel/speed-insights/react';
// import { Analytics } from '@vercel/analytics/react';


// --- Constants ---
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
const FaArrowLeft = () => <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 256 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M192 448c-8.188 0-16.38-3.125-22.62-9.375l-160-160c-12.5-12.5-12.5-32.75 0-45.25l160-160c12.5-12.5 32.75-12.5 45.25 0s12.5 32.75 0 45.25L77.25 256l137.4 137.4c12.5 12.5 12.5 32.75 0 45.25C208.4 444.9 200.2 448 192 448z"></path></svg>;
const FaArrowRight = () => <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 256 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M64 448c-8.188 0-16.38-3.125-22.62-9.375c-12.5-12.5-12.5-32.75 0-45.25L178.8 256L41.38 118.6c-12.5-12.5-12.5-32.75 0-45.25s32.75-12.5 45.25 0l160 160c12.5 12.5 12.5 32.75 0 45.25l-160 160C80.38 444.9 72.19 448 64 448z"></path></svg>;
const MenuIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>;
const CloseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;


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
                const [stats, profile] = await Promise.all([
                    fetch(`https://api.chess.com/pub/player/${selectedPlayer}/stats`).then(res => res.json()),
                    fetch(`https://api.chess.com/pub/player/${selectedPlayer}`).then(res => res.json())
                ]);
                setPlayerData({ stats, profile });
            } catch (error) {
                console.error("Failed to fetch player data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAllPlayerData();
    }, [selectedPlayer, allOpeningStats]);

    const getWinRate = (record) => {
        const wins = record?.win || 0;
        const losses = record?.loss || 0;
        const draws = record?.draw || 0;
        const total = wins + losses + draws;

        if (total === 0) return "N/A";
        const winPct = (wins / total) * 100;
        return `${winPct.toFixed(1)}%`;
    };

    const StatCard = ({ title, rating, record }) => (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 text-center">
            <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400">{title}</h3>
            <p className="text-4xl font-bold text-gray-800 dark:text-gray-100 my-2">{rating || 'N/A'}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">W: {record?.win || 0} / L: {record?.loss || 0} / D: {record?.draw || 0}</p>
            <p className="text-sm mt-1 text-indigo-500 dark:text-indigo-300 font-semibold">Win Rate: {getWinRate(record)}</p>
        </div>
    );

    const TopOpeningsList = ({ title, data }) => {
        const top5 = data
            .sort((a, b) => b.games_played - a.games_played)
            .slice(0, 5);

        if (top5.length === 0) {
            return (
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">{title}</h3>
                    <p className="text-gray-500 dark:text-gray-400">No opening data available.</p>
                </div>
            );
        }

        return (
            <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">{title}</h3>
                <ol className="list-decimal ml-6 space-y-1 text-gray-700 dark:text-gray-200">
                    {top5.map((opening, idx) => {
                        const wins = opening.white_wins || opening.black_wins || 0;
                        return (
                            <li key={idx}>
                                <span className="font-medium">{opening.opening_name}</span> — {opening.games_played} games (
                                {wins}W / {opening.losses}L / {opening.draws}D)
                            </li>
                        );
                    })}
                </ol>
            </div>
        );
    };

    return (
        <div>
            <h1 className="text-4xl font-bold mb-8 text-gray-800 dark:text-gray-200">Player Stats</h1>

            <div className="mb-8">
                <label htmlFor="player-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select a Player</label>
                <select
                    id="player-select"
                    value={selectedPlayer}
                    onChange={e => setSelectedPlayer(e.target.value)}
                    className="block w-full md:w-1/2 p-3 border border-gray-300 bg-white dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                    {FRIENDS.map(friend => <option key={friend.username} value={friend.username}>{friend.name}</option>)}
                </select>
            </div>

            {loading ? (
                <p className="text-center text-gray-600 dark:text-gray-400">Loading player data...</p>
            ) : playerData ? (
                <>
                    <div className="flex items-center mb-6 gap-4">
                        {playerData.profile?.avatar && (
                            <img
                                src={playerData.profile.avatar}
                                alt={`${selectedPlayer}'s avatar`}
                                className="w-20 h-20 rounded-full border-4 border-indigo-500"
                            />
                        )}
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{playerData.profile?.name || selectedPlayer}</h2>
                            {playerData.profile?.title && (
                                <p className="text-sm text-indigo-400 font-semibold uppercase">{playerData.profile.title}</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatCard
                            title="Rapid"
                            rating={playerData.stats?.chess_rapid?.last.rating}
                            record={playerData.stats?.chess_rapid?.record}
                        />
                        <StatCard
                            title="Blitz"
                            rating={playerData.stats?.chess_blitz?.last.rating}
                            record={playerData.stats?.chess_blitz?.record}
                        />
                        <StatCard
                            title="Bullet"
                            rating={playerData.stats?.chess_bullet?.last.rating}
                            record={playerData.stats?.chess_bullet?.record}
                        />
                    </div>

                    <div className="mt-10 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                        <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Favorite Openings</h2>

                        <TopOpeningsList
                            title="Top 5 as White"
                            data={allOpeningStats.filter(s =>
                                s.player === FRIENDS.find(f => f.username === selectedPlayer)?.name && s.color === 'white'
                            )}
                        />
                        <TopOpeningsList
                            title="Top 5 as Black"
                            data={allOpeningStats.filter(s =>
                                s.player === FRIENDS.find(f => f.username === selectedPlayer)?.name && s.color === 'black'
                            )}
                        />
                    </div>
                </>
            ) : (
                <p>Could not load player data.</p>
            )}
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
    const [commentary, setCommentary] = useState('');
    const [isGeneratingCommentary, setIsGeneratingCommentary] = useState(false);
    const stockfish = useRef(null);
    const messageHistory = useRef([]);

    const getAiCommentary = useCallback(async (fen, lastMoveSan, stockfishEval, stockfishTopMoves) => {
        if (!lastMoveSan) {
            setCommentary('This is the starting position. Load a PGN and make a move to begin analysis.');
            return;
        }
        setIsGeneratingCommentary(true);
        setCommentary('');
        let chatHistory = [];
        const prompt = `Analyze the following chess move and provide a brief, insightful commentary.
        
        **Context:**
        - **Game State (FEN):** ${fen}
        - **The move just played:** ${lastMoveSan}
        - **Stockfish Evaluation:** ${stockfishEval}
        - **Stockfish's Top 3 Suggested Moves:** ${stockfishTopMoves.map(m => m.san).join(', ')}

        **Instructions:**
        1.  Act as an expert chess commentator.
        2.  Briefly explain the purpose of the move '${lastMoveSan}'.
        3.  State whether the move was good, an inaccuracy, a blunder, or excellent, using the engine's evaluation as a guide.
        4.  Mention the best move if it's different from the one played.
        5.  Keep the commentary concise (2-3 sentences).`;
        
        chatHistory.push({ role: "user", parts: [{ text: prompt }] });
        const payload = { contents: chatHistory };
        const apiKey = "" 
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
             if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const text = result.candidates[0].content.parts[0].text;
                setCommentary(text);
            } else {
                setCommentary("Could not generate commentary for this move.");
            }
        } catch(error) {
            console.error("Error generating commentary:", error);
            setCommentary("An error occurred while generating commentary.");
        } finally {
            setIsGeneratingCommentary(false);
        }
    }, []);

    const getEvaluation = useCallback((fen, lastMoveSan) => {
        if (engineStatus !== 'Ready' || !stockfish.current) return;
        setEvaluation('...');
        setTopMoves([]);
        setCommentary('');
        
        const onMessage = (event) => {
            const message = String(event.data);
            messageHistory.current.push(message);

            if (message.startsWith('bestmove')) {
                const finalTopMoves = [];
                const tempGame = new Chess(fen);
                 messageHistory.current.forEach(line => {
                    if(line.startsWith('info depth') && line.includes('multipv')) {
                        const multipvMatch = line.match(/multipv (\d+)/);
                        const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
                        const pvMatch = line.match(/ pv (.+)/);

                        if (multipvMatch && scoreMatch && pvMatch) {
                            const pvIndex = parseInt(multipvMatch[1], 10) - 1;
                            const scoreType = scoreMatch[1];
                            let scoreValue = parseInt(scoreMatch[2], 10);
                            const firstMove = pvMatch[1].split(' ')[0];

                            if(scoreType === 'cp'){
                                scoreValue = (scoreValue / 100.0).toFixed(2);
                            } else {
                                scoreValue = `M${scoreValue}`;
                            }
                            
                            const moveResult = tempGame.move(firstMove, { sloppy: true });
                            if (moveResult) {
                                finalTopMoves[pvIndex] = {san: moveResult.san, score: scoreValue};
                                tempGame.undo();
                            }
                        }
                    }
                });
                
                if(finalTopMoves.length > 0) {
                    setEvaluation(finalTopMoves[0].score);
                    setTopMoves(finalTopMoves.slice(0,3));
                    if(lastMoveSan) {
                        getAiCommentary(fen, lastMoveSan, finalTopMoves[0].score, finalTopMoves);
                    } else {
                        setCommentary('This is the starting position. Make a move or navigate to see commentary.');
                    }
                }
                
                stockfish.current.removeEventListener('message', onMessage);
            }
        };

        stockfish.current.addEventListener('message', onMessage);
        messageHistory.current = [];
        stockfish.current.postMessage(`position fen ${fen}`);
        stockfish.current.postMessage('go depth 15');
    }, [engineStatus, getAiCommentary]);

    useEffect(() => {
        const STOCKFISH_URL = process.env.PUBLIC_URL + '/stockfish-17-lite-single.js';
        let worker;
        try {
            worker = new Worker(STOCKFISH_URL);
            stockfish.current = worker;

            const onUciOk = (event) => {
                 if (String(event.data) === 'uciok') {
                    worker.postMessage('setoption name MultiPV value 3');
                    worker.postMessage('isready');
                 }
                 if(String(event.data) === 'readyok'){
                    setEngineStatus('Ready');
                    worker.removeEventListener('message', onUciOk);
                 }
            };
            worker.addEventListener('message', onUciOk);

            worker.onerror = (e) => {
                 setEngineStatus(`Error: Stockfish failed.`);
                 console.error("Stockfish worker error:", e);
            };
            worker.postMessage('uci');

            return () => {
                worker.terminate();
            };
        } catch (error) {
            setEngineStatus('Failed to load worker.');
            console.error("Failed to initialize Stockfish worker:", error);
        }
    }, []);

    const handleLoadPgn = () => {
        setPgnError('');
        const newGame = new Chess();
        try {
            let pgnString = pgn.trim();
            const tagRegex = /\[\s*(\w+)\s*"([^"]*)"\s*\]/g;
            const tags = pgnString.match(tagRegex) || [];
            const movetext = pgnString.replace(tagRegex, '').trim();
            const cleanedMovetext = movetext
                .replace(/\{[^}]*?\}/g, '')
                .replace(/\([^)]*?\)/g, '')
                .replace(/\$\d+/g, '')
                .replace(/[\r\n\t]+/g, ' ')
                .trim();
            const cleanedPgn = tags.join('\n') + '\n\n' + cleanedMovetext;
            newGame.loadPgn(cleanedPgn);

            if (newGame.history().length === 0) throw new Error("PGN loaded, but no moves found.");
            
            const startingFen = new Chess().fen();
            setGame(new Chess(startingFen));
            setHistory(newGame.history({ verbose: true }));
            setCurrentMove(-1);
            getEvaluation(startingFen, null);

        } catch (e) {
            setPgnError(e.message || "Error loading PGN.");
            setGame(new Chess());
            setHistory([]);
            setCurrentMove(-1);
            setEvaluation('');
            setTopMoves([]);
            setCommentary('');
        }
    };

    const navigateToMove = useCallback((index) => {
        const tempGame = new Chess();
        const fullHistory = history.map(h => h.san);
        let lastMoveSan = null;
        for (let i = 0; i <= index; i++) {
            if (fullHistory[i]) {
                const moveResult = tempGame.move(fullHistory[i]);
                if(i === index){
                    lastMoveSan = moveResult.san;
                }
            }
        }
        setGame(tempGame);
        setCurrentMove(index);
        getEvaluation(tempGame.fen(), lastMoveSan);
    }, [history, getEvaluation]);

    const goToPreviousMove = useCallback(() => {
        if (currentMove > -1) navigateToMove(currentMove - 1);
    }, [currentMove, navigateToMove]);

    const goToNextMove = useCallback(() => {
        if (currentMove < history.length - 1) navigateToMove(currentMove + 1);
    }, [currentMove, history.length, navigateToMove]);

    const isGameLoaded = history.length > 0;

    const EvaluationBar = ({ score }) => {
        const numScore = parseFloat(score);
        if (isNaN(numScore)) {
            return (
                <div className="w-full bg-gray-700 rounded-full h-6 dark:bg-gray-800 my-2 relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-300">Eval: {score}</div>
                </div>
            );
        }
        const clampedScore = Math.max(-10, Math.min(10, numScore));
        const percentage = 50 + (clampedScore * 5);
        const barColor = numScore >= 0 ? 'bg-white' : 'bg-gray-800 dark:bg-gray-200';

        return (
            <div className="w-full bg-gray-700 rounded-full h-6 dark:bg-gray-800 my-2 relative overflow-hidden">
                <div className={`${barColor} h-full absolute top-0 left-0 transition-all duration-300 ease-in-out`} style={{ width: `${percentage}%` }} />
                 <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-black dark:text-white mix-blend-difference">Eval: {score}</div>
            </div>
        );
    };

    return (
        <div>
            <h1 className="text-4xl font-bold mb-8 text-gray-800 dark:text-gray-200">Chess Analysis</h1>
            <div className="flex flex-col lg:flex-row gap-8 items-start">
                <div className="w-full lg:w-auto lg:max-w-md">
                    <Chessboard position={game.fen()} boardWidth={Math.min(400, window.innerWidth - 60)} />
                    {isGameLoaded && <EvaluationBar score={evaluation} />}
                </div>
                <div className="w-full lg:flex-1 space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
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
                        <button onClick={handleLoadPgn} disabled={engineStatus !== 'Ready'} className="mt-4 w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition disabled:bg-gray-400">
                            Load Game & Analyze
                        </button>
                    </div>

                    {isGameLoaded && (
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                             <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-3">Analysis</h3>
                             <div className="h-48 overflow-y-auto bg-gray-50 dark:bg-gray-700 rounded-md p-2 mb-4">
                                 <ol className="grid grid-cols-[auto_1fr_1fr] gap-x-4 gap-y-1 text-sm">
                                     {history.reduce((acc, move, index) => {
                                         if (index % 2 === 0) acc.push([move]);
                                         else acc[acc.length - 1].push(move);
                                         return acc;
                                     }, []).map((movePair, index) => (
                                         <React.Fragment key={index}>
                                             <div className="text-right text-gray-500 dark:text-gray-400">{index + 1}.</div>
                                             {movePair.map((move, moveIndex) => (
                                                 <div key={moveIndex} onClick={() => navigateToMove(index * 2 + moveIndex)} className={`p-1 rounded cursor-pointer hover:bg-indigo-100 dark:hover:bg-gray-600 ${currentMove === (index * 2 + moveIndex) ? 'bg-indigo-200 dark:bg-gray-900 font-bold' : ''}`}>
                                                     {move.san}
                                                 </div>
                                             ))}
                                         </React.Fragment>
                                     ))}
                                 </ol>
                             </div>
                             <div className="flex justify-center gap-4 mb-4">
                                 <button onClick={goToPreviousMove} disabled={currentMove <= -1} className="p-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed" aria-label="Previous move"><FaArrowLeft /></button>
                                 <button onClick={goToNextMove} disabled={currentMove >= history.length - 1} className="p-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed" aria-label="Next move"><FaArrowRight /></button>
                             </div>
                             <div>
                                 <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Top Engine Moves:</h3>
                                 {topMoves.length > 0 ? (
                                    <ul className="space-y-1 mt-2 text-gray-600 dark:text-gray-400">
                                        {topMoves.map((move, index) => (
                                            <li key={index} className="flex justify-between p-1 bg-gray-100 dark:bg-gray-600 rounded">
                                                <span><span className="font-bold">{index + 1}.</span> {move.san}</span>
                                                <span className="font-mono text-sm">{move.score}</span>
                                            </li>
                                        ))}
                                    </ul>
                                 ) : (
                                    <p className="text-gray-500 dark:text-gray-400 mt-2">Analyzing...</p>
                                 )}
                             </div>
                             <div className="mt-4">
                                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Move Commentary:</h3>
                                {isGeneratingCommentary ? (
                                    <p className="text-gray-500 dark:text-gray-400 mt-2">Generating commentary...</p>
                                ) : (
                                    <p className="text-gray-600 dark:text-gray-300 mt-2">{commentary || 'No commentary available.'}</p>
                                )}
                             </div>
                        </div>
                    )}
                </div>
            </div>
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
