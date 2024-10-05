'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import io, { Socket } from 'socket.io-client';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useRouter } from 'next/navigation';

type ChatMessage = {
  id: string;
  text: string;
};

export default function Session() {
  const { sessionId } = useParams();
  const [name, setName] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [tempName, setTempName] = useState('');
  const [roomId, setRoomId] = useState('');
  const router = useRouter();

  useEffect(() => {
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');
      if (sessionId) {
        newSocket.emit('joinRoom', sessionId);
      }
    });

    newSocket.on('roomJoined', (id) => {
      setRoomId(id);
      const searchParams = new URLSearchParams(window.location.search);
      const created = searchParams.get('created');
      if (created === 'true') {
        toast.success('Session created successfully!');
      } else {
        toast.success('Session joined successfully!');
      }
    });

    newSocket.on('roomError', (message) => {
      router.push(`/session?error=${encodeURIComponent(message)}`);
    });

    newSocket.on('chatMessage', (message: ChatMessage) => {
      console.log('Received message:', message);
      setMessages((prevMessages) => [...prevMessages, message]);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [sessionId, router]);

  const handleNameSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (tempName.trim() && socket && sessionId) {
      setName(tempName);
      socket.emit('setName', { roomId: sessionId, name: tempName });
    }
  };

  const handleMessageSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (inputMessage.trim() && socket && name) {
      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        text: inputMessage,
      };
      socket.emit('sendMessage', { roomId: sessionId, message: newMessage });
      setInputMessage('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-blue-800 mb-6">Study Session</h1>
        <p className="text-xl mb-4">Session ID: <span className="font-bold">{sessionId}</span></p>
        
        {!name ? (
          <form onSubmit={handleNameSubmit} className="mb-6">
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              placeholder="Enter your name"
              className="w-full p-2 border rounded"
            />
            <button type="submit" className="mt-2 bg-blue-600 text-white px-4 py-2 rounded">
              Set Name
            </button>
          </form>
        ) : (
          <div className="mb-6">
            <p className="text-lg">Welcome, {name}!</p>
          </div>
        )}

        <div className="h-64 overflow-y-auto border rounded p-4 mb-4">
          {messages.map((msg) => (
            <p key={msg.id} className="mb-2">
              {msg.text}
            </p>
          ))}
        </div>

        <form onSubmit={handleMessageSubmit}>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type a message..."
            className="w-full p-2 border rounded"
          />
          <button type="submit" className="mt-2 bg-blue-600 text-white px-4 py-2 rounded">
            Send
          </button>
        </form>
      </div>
      <ToastContainer position="bottom-right" />
    </div>
  );
}
