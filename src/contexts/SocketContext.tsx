import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'react-hot-toast';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  connect: (sessionId: string, role: 'client' | 'advisor') => void;
  disconnect: () => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  connect: () => {},
  disconnect: () => {},
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const connectingRef = useRef<boolean>(false);

  const disconnect = useCallback(() => {
    if (socket) {
      console.log('🔌 Disconnecting socket...');
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      socketRef.current = null;
      connectingRef.current = false;
    }
  }, [socket]);

  const connect = useCallback((sessionId: string, role: 'client' | 'advisor') => {
    // Prevent multiple simultaneous connection attempts
    if (connectingRef.current) {
      console.log('⚠️ Connection already in progress, skipping');
      return;
    }
    
    connectingRef.current = true;
    
    // Disconnect existing socket first
    if (socketRef.current) {
      console.log('🔄 Socket already exists, disconnecting first...');
      socketRef.current.disconnect();
      setSocket(null);
      setIsConnected(false);
      socketRef.current = null;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_SERVER_URL;
    if (!socketUrl) {
      console.error('❌ Socket server URL not configured');
      console.error('Available env vars:', Object.keys(import.meta.env));
      toast.error('Chat service not configured. Please check environment variables.');
      connectingRef.current = false;
      return;
    }

    console.log('🚀 Connecting to socket server:', socketUrl);
    console.log('📍 Session ID:', sessionId, 'Role:', role);

    try {
      const newSocket = io(socketUrl, {
        transports: ['websocket', 'polling'], // Allow fallback to polling
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 30000, // Increased timeout to 30 seconds
        query: { sessionId, role },
        forceNew: true // Force a new connection
      });

      // Set up event listeners
      newSocket.on('connect', () => {
        console.log('✅ Socket connected successfully with ID:', newSocket.id);
        setIsConnected(true);
        connectingRef.current = false;
        
        // Join the session room
        console.log('🏠 Joining room:', sessionId);
        newSocket.emit('join_room', sessionId);
      });

      newSocket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
        setIsConnected(false);
        connectingRef.current = false;
        
        // Provide more specific error messages
        if (error.message.includes('timeout')) {
          toast.error('Connection timeout. Please check your internet connection.');
        } else if (error.message.includes('ECONNREFUSED')) {
          toast.error('Chat server is not available. Please try again later.');
        } else {
          toast.error('Failed to connect to chat server');
        }
      });

      newSocket.on('disconnect', (reason) => {
        console.log('⚠️ Socket disconnected. Reason:', reason);
        setIsConnected(false);
        
        // Only show error if it's not a manual disconnect
        if (reason !== 'io client disconnect' && reason !== 'client namespace disconnect') {
          toast.error('Disconnected from chat server');
        }
      });

      newSocket.on('error', (error) => {
        console.error('🚨 Socket error:', error);
        toast.error('Chat connection error');
      });

      // Handle reconnection
      newSocket.on('reconnect', (attemptNumber) => {
        console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
        setIsConnected(true);
        toast.success('Reconnected to chat');
        
        // Rejoin the room after reconnection
        newSocket.emit('join_room', sessionId);
      });

      newSocket.on('reconnect_error', (error) => {
        console.error('❌ Reconnection failed:', error);
        connectingRef.current = false;
      });

      newSocket.on('reconnect_failed', () => {
        console.error('❌ Failed to reconnect after maximum attempts');
        toast.error('Failed to reconnect to chat. Please refresh the page.');
        connectingRef.current = false;
      });

      // Store the socket in state and ref
      setSocket(newSocket);
      socketRef.current = newSocket;

    } catch (error) {
      console.error('❌ Error creating socket connection:', error);
      toast.error('Failed to initialize chat connection');
      connectingRef.current = false;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        console.log('🧹 Cleaning up socket connection...');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={{ 
      socket, 
      isConnected, 
      connect, 
      disconnect 
    }}>
      {children}
    </SocketContext.Provider>
  );
};