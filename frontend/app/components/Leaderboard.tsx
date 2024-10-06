import React from 'react';

type Player = {
  id: string;
  name: string;
  points: number;
};

type LeaderboardProps = {
  players: Player[];
};

const Leaderboard: React.FC<LeaderboardProps> = ({ players }) => {
  const sortedPlayers = [...players].sort((a, b) => b.points - a.points);

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-2xl font-bold text-blue-800 mb-4">Leaderboard</h2>
      <ul>
        {sortedPlayers.map((player, index) => (
          <li key={player.id} className="flex justify-between items-center mb-2">
            <span className="font-semibold text-black">{index + 1}. {player.name}</span>
            <span className="text-blue-600 font-bold">{player.points} points</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Leaderboard;
