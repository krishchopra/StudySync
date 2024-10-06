import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

type Section = {
  title: string;
  content: string;
};

type SectionsProps = {
  sessionId: string;
  socket: Socket | null;
};

const Sections: React.FC<SectionsProps> = ({ sessionId, socket }) => {
  const [sections, setSections] = useState<Section[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

  useEffect(() => {
    if (socket) {
      setIsLoading(true);
      setError(null);
      socket.emit('getSections', sessionId);

      const timeoutId = setTimeout(() => {
        setIsLoading(false);
        setError('Timeout: Failed to receive sections');
      }, 10000); // set a 10-second timeout

      socket.on('sectionsUpdated', (updatedSections: Section[]) => {
        console.log('Received sections from backend:', updatedSections);
        setSections(updatedSections);
        setIsLoading(false);
        setError(null);
        clearTimeout(timeoutId);
      });

      return () => {
        clearTimeout(timeoutId);
        socket.off('sectionsUpdated');
      };
    }
  }, [sessionId, socket]);

  const handleGenerateQuiz = () => {
    if (socket && currentSectionIndex < sections.length) {
      socket.emit("generateQuiz", sessionId, currentSectionIndex);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-2xl font-bold text-blue-800 mb-4">Sections</h2>
      {sections.length === 0 ? (
        <p className="text-gray-600">No sections available yet.</p>
      ) : (
        <div>
          <ol className="list-decimal list-inside h-64 overflow-y-auto">
            {sections.map((section, index) => (
              <li key={index} className="mb-4">
                <span className="-ml-5 font-semibold text-blue-600">{section.title}</span>
                <p className="text-sm text-gray-600 pt-1">{section.content}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

export default Sections;
