import React, { useState } from 'react';

type Player = {
  id: string;
  name: string;
  points: number;
};

type LeaderboardProps = {
  players: Player[];
};

const Leaderboard: React.FC<LeaderboardProps> = ({ players }) => {
  const [showPoints, setShowPoints] = useState(false);
  const sortedPlayers = [...players].sort((a, b) => b.points - a.points);

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-2xl font-bold text-blue-800 mb-4">Leaderboard</h2>
      <ul>
        {sortedPlayers.map((player, index) => (
          <li key={player.id} className="flex justify-between items-center mb-2 leaderboard-item">
            <span className="font-semibold text-black">{index + 1}. {player.name}</span>
            {showPoints &&
            <p className='text-blue-600'> <span className='font-bold'>{player.points}</span> points</p>}
          </li>
        ))}
      </ul>
      <div className="flex justify-end">
        <button
          onClick={() => setShowPoints(!showPoints)}
          className="mt-4 bg-blue-600 text-white py-1 rounded-full text-sm px-3 hover:bg-blue-700"
        >
          {showPoints ? 'Hide Points' : 'Show Points'}
        </button>
      </div>
    </div>
  );
};

export default Leaderboard;
