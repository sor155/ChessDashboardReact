import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

// --- Mock Data (replace with API calls) ---
// In a real application, you would fetch this data from a backend API.
// For this example, we'll use mock data similar to what your Python scripts generate.

const mockCurrentRatings = [
    { friend_name: 'Ulysse', rapid_rating: 1971, blitz_rating: 1491, bullet_rating: 1349, rapid_change: 20, blitz_change: -10, bullet_change: 5 },
    { friend_name: 'Simon', rapid_rating: 1006, blitz_rating: 405, bullet_rating: 716, rapid_change: -5, blitz_change: 15, bullet_change: 0 },
    { friend_name: 'Adrien', rapid_rating: 1619, blitz_rating: 1163, bullet_rating: 747, rapid_change: 30, blitz_change: 0, bullet_change: -20 },
    { friend_name: 'Alex', rapid_rating: 841, blitz_rating: 268, bullet_rating: 487, rapid_change: 10, blitz_change: 5, bullet_change: 10 },
    { friend_name: 'Kevin', rapid_rating: 702, blitz_rating: 846, bullet_rating: 577, rapid_change: 0, blitz_change: 25, bullet_change: -5 },
];

const mockRatingHistory = [
    { timestamp: '2023-01-01', player_name: 'Ulysse', category: 'Rapid', rating: 1950 },
    { timestamp: '2023-01-01', player_name: 'Simon', category: 'Rapid', rating: 1000 },
    { timestamp: '2023-02-01', player_name: 'Ulysse', category: 'Rapid', rating: 1965 },
    { timestamp: '2023-02-01', player_name: 'Simon', category: 'Rapid', rating: 1010 },
    { timestamp: '2023-03-01', player_name: 'Ulysse', category: 'Rapid', rating: 1971 },
    { timestamp: '2023-03-01', player_name: 'Simon', category: 'Rapid', rating: 1006 },
    { timestamp: '2023-01-01', player_name: 'Ulysse', category: 'Blitz', rating: 1500 },
    { timestamp: '2023-02-01', player_name: 'Ulysse', category: 'Blitz', rating: 1495 },
    { timestamp: '2023-03-01', player_name: 'Ulysse', category: 'Blitz', rating: 1491 },
];


// --- API Fetching Functions ---

const FRIENDS = [
    { name: "Ulysse", username: "realulysse" },
    { name: "Simon", username: "poulet_tao" },
    { name: "Adrien", username: "adrienbourque" },
    { name: "Alex", username: "naatiry" },
    { name: "Kevin", username: "kevor24" },
];

async function fetchChessComStats(username) {
    try {
        const response = await fetch(`https://api.chess.com/pub/player/${username}/stats`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return await response.json();
    } catch (error) {
        console.error("Failed to fetch Chess.com stats:", error);
        return null;
    }
}


// --- Components ---

function Dashboard({ currentRatings, ratingHistory }) {
    return (
        <div className="p-4 md:p-6">
            <h2 className="text-3xl font-bold mb-6 text-gray-800">Chess Rating Dashboard</h2>
            
            <div className="mb-8">
                <h3 className="text-2xl font-semibold mb-4 text-gray-700">Current Ratings</h3>
                <div className="overflow-x-auto bg-white rounded-lg shadow">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rapid</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Blitz</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bullet</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {currentRatings.map(player => (
                                <tr key={player.friend_name}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{player.friend_name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{player.rapid_rating}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{player.blitz_rating}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{player.bullet_rating}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div>
                <h3 className="text-2xl font-semibold mb-4 text-gray-700">Rating Progression (Rapid)</h3>
                <div className="bg-white rounded-lg shadow p-4" style={{ height: '400px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={ratingHistory.filter(h => h.category === 'Rapid')}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="timestamp" />
                            <YAxis domain={['dataMin - 20', 'dataMax + 20']}/>
                            <Tooltip />
                            <Legend />
                            {FRIENDS.map(friend => (
                                <Line 
                                    key={friend.name}
                                    type="monotone" 
                                    dataKey="rating" 
                                    name={friend.name}
                                    data={ratingHistory.filter(h => h.player_name === friend.name && h.category === 'Rapid')}
                                    stroke={`#${(0x1000000+Math.random()*0xffffff).toString(16).substr(1,6)}`} // Random color
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}

function PlayerStats() {
    const [selectedPlayer, setSelectedPlayer] = useState(FRIENDS[0].username);
    const [playerStats, setPlayerStats] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(true);
        fetchChessComStats(selectedPlayer).then(data => {
            setPlayerStats(data);
            setLoading(false);
        });
    }, [selectedPlayer]);

    return (
        <div className="p-4 md:p-6">
            <h2 className="text-3xl font-bold mb-6 text-gray-800">Player Stats</h2>
            <select 
                value={selectedPlayer}
                onChange={e => setSelectedPlayer(e.target.value)}
                className="mb-6 block w-full md:w-1/3 p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
                {FRIENDS.map(friend => <option key={friend.username} value={friend.username}>{friend.name}</option>)}
            </select>

            {loading && <p>Loading stats...</p>}

            {!loading && playerStats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-lg shadow p-6">
                        <h4 className="text-lg font-semibold text-gray-700">Rapid</h4>
                        <p className="text-3xl font-bold text-indigo-600">{playerStats.chess_rapid?.last.rating || 'N/A'}</p>
                        <p className="text-sm text-gray-500">W: {playerStats.chess_rapid?.record.win || 0} / L: {playerStats.chess_rapid?.record.loss || 0} / D: {playerStats.chess_rapid?.record.draw || 0}</p>
                    </div>
                     <div className="bg-white rounded-lg shadow p-6">
                        <h4 className="text-lg font-semibold text-gray-700">Blitz</h4>
                        <p className="text-3xl font-bold text-indigo-600">{playerStats.chess_blitz?.last.rating || 'N/A'}</p>
                         <p className="text-sm text-gray-500">W: {playerStats.chess_blitz?.record.win || 0} / L: {playerStats.chess_blitz?.record.loss || 0} / D: {playerStats.chess_blitz?.record.draw || 0}</p>
                    </div>
                     <div className="bg-white rounded-lg shadow p-6">
                        <h4 className="text-lg font-semibold text-gray-700">Bullet</h4>
                        <p className="text-3xl font-bold text-indigo-600">{playerStats.chess_bullet?.last.rating || 'N/A'}</p>
                         <p className="text-sm text-gray-500">W: {playerStats.chess_bullet?.record.win || 0} / L: {playerStats.chess_bullet?.record.loss || 0} / D: {playerStats.chess_bullet?.record.draw || 0}</p>
                    </div>
                </div>
            )}
        </div>
    );
}


function InteractiveAnalysis() {
    const [game, setGame] = useState(new Chess());

    function makeAMove(move) {
        const gameCopy = new Chess(game.fen());
        const result = gameCopy.move(move);
        setGame(gameCopy);
        return result; 
    }

    function onDrop(sourceSquare, targetSquare) {
        const move = makeAMove({
            from: sourceSquare,
            to: targetSquare,
            promotion: 'q',
        });

        // illegal move
        if (move === null) {
            return false;
        }
        return true;
    }

    return (
        <div className="p-4 md:p-6">
            <h2 className="text-3xl font-bold mb-6 text-gray-800">Interactive Analysis</h2>
            <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-1/2">
                    <Chessboard position={game.fen()} onPieceDrop={onDrop} />
                </div>
                <div className="w-full md:w-1/2 bg-white p-6 rounded-lg shadow">
                     <h3 className="text-xl font-semibold mb-4">Game Status</h3>
                     <p>{game.isGameOver() ? "Game Over" : "In Progress"}</p>
                     <p>{game.isCheckmate() && "Checkmate!"}</p>
                     <p>{game.isDraw() && "Draw!"}</p>
                     <p>{game.isStalemate() && "Stalemate!"}</p>
                     <p>{game.isThreefoldRepetition() && "Threefold Repetition!"}</p>
                    <button 
                        onClick={() => {
                            setGame(new Chess());
                        }}
                        className="mt-4 w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition"
                    >
                        Reset Board
                    </button>
                </div>
            </div>
        </div>
    );
}


// --- Main App Component ---
export default function App() {
    const [activeTab, setActiveTab] = useState('Dashboard');

    const renderTab = () => {
        switch (activeTab) {
            case 'Dashboard':
                return <Dashboard currentRatings={mockCurrentRatings} ratingHistory={mockRatingHistory} />;
            case 'Player Stats':
                return <PlayerStats />;
            case 'Interactive Analysis':
                return <InteractiveAnalysis />;
            default:
                return <Dashboard currentRatings={mockCurrentRatings} ratingHistory={mockRatingHistory} />;
        }
    };

    const TabButton = ({ name }) => (
        <button
            onClick={() => setActiveTab(name)}
            className={`px-4 py-2 text-sm font-medium rounded-md ${
                activeTab === name
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 hover:bg-gray-200'
            }`}
        >
            {name}
        </button>
    );

    return (
        <div className="bg-gray-100 min-h-screen font-sans">
            <nav className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center">
                           <span className="font-bold text-xl text-gray-800">Chess Dashboard</span>
                        </div>
                        <div className="flex space-x-2">
                            <TabButton name="Dashboard" />
                            <TabButton name="Player Stats" />
                            <TabButton name="Interactive Analysis" />
                        </div>
                    </div>
                </div>
            </nav>
            <main>
                {renderTab()}
            </main>
        </div>
    );
}