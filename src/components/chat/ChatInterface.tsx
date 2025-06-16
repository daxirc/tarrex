import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Send, X, Loader2 } from 'lucide-react';
import Button from '../ui/Button';
import Avatar from '../ui/Avatar';
import BillingTimer from './BillingTimer';
import { useSocket } from '../../contexts/SocketContext';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';

interface ChatMessage {
  sessionId: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: number;
  type: 'text' | 'system';
}

interface ChatInterfaceProps {
  sessionId: string;
  userId: string;
  recipientId: string;
  onClose: () => void;
}

export default function ChatInterface({
  sessionId,
  userId,
  recipientId,
  onClose
}: ChatInterfaceProps) {
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const { user } = useStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isChatActive, setIsChatActive] = useState(true);
  const [showReturnButton, setShowReturnButton] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [sessionEndedBy, setSessionEndedBy] = useState<string | null>(null);
  const [autoRedirectTimer, setAutoRedirectTimer] = useState<number | null>(null);
  const [advisorRate, setAdvisorRate] = useState<number>(1.99);
  const [billingActive, setBillingActive] = useState<boolean>(false);
  const [insufficientFunds, setInsufficientFunds] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-redirect timer effect
  useEffect(() => {
    if (autoRedirectTimer !== null && autoRedirectTimer > 0) {
      const timer = setTimeout(() => {
        setAutoRedirectTimer(prev => prev ? prev - 1 : 0);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (autoRedirectTimer === 0) {
      handleReturn();
    }
  }, [autoRedirectTimer]);

  // Fetch advisor rate
  useEffect(() => {
    const fetchAdvisorRate = async () => {
      try {
        // Determine who is the advisor
        const advisorId = user?.role === 'advisor' ? userId : recipientId;
        
        const { data, error } = await supabase
          .from('advisor_profiles')
          .select('price_per_minute')
          .eq('user_id', advisorId)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (error) throw error;
        
        if (data && data.length > 0 && data[0].price_per_minute) {
          setAdvisorRate(data[0].price_per_minute);
        }
      } catch (error) {
        console.error('Error fetching advisor rate:', error);
      }
    };

    fetchAdvisorRate();
  }, [userId, recipientId, user?.role]);

  // Check session status on mount and periodically
  useEffect(() => {
    const checkSessionStatus = async () => {
      try {
        const { data: session, error } = await supabase
          .from('sessions')
          .select('status, start_time')
          .eq('id', sessionId)
          .single();

        if (error) {
          console.error('Error checking session status:', error);
          return;
        }

        if (session?.status === 'completed' || session?.status === 'cancelled') {
          console.log('🔚 Session already ended, status:', session.status);
          
          // Only update state if the session isn't already marked as inactive
          if (isChatActive) {
            setIsChatActive(false);
            setBillingActive(false);
            setSessionEndedBy('Other participant');
            setShowReturnButton(true);
            
            // Don't add a message here - we'll let the socket event handler do that
          }
        } else if (session?.status === 'in_progress' && session?.start_time) {
          // If session is in progress and has a start time, activate billing
          if (user?.role === 'advisor') {
            setBillingActive(true);
            
            // Emit billing_start event to start server-side billing
            if (socket && isConnected) {
              socket.emit('billing_start', {
                sessionId,
                advisorId: userId,
                clientId: recipientId,
                startTime: session.start_time
              });
            }
          }
        }
      } catch (error) {
        console.error('Error checking session status:', error);
      }
    };

    // Check immediately
    checkSessionStatus();

    // Set up periodic check every 5 seconds
    const interval = setInterval(checkSessionStatus, 5000);

    return () => clearInterval(interval);
  }, [sessionId, socket, isConnected, userId, recipientId, user?.role, isChatActive]);

  // Initial connection setup
  useEffect(() => {
    setConnectionStatus(isConnected ? 'connected' : 'connecting');
    
    if (isConnected && socket) {
      console.log('✅ Socket is connected, joining room:', sessionId);
      socket.emit('join_room', sessionId);
      
      // Add welcome message if no messages yet
      if (messages.length === 0) {
        const welcomeMessage: ChatMessage = {
          sessionId,
          senderId: 'system',
          receiverId: 'all',
          content: 'Chat session started. You can now send messages.',
          timestamp: Date.now(),
          type: 'system'
        };
        setMessages([welcomeMessage]);
      }
    }
  }, [isConnected, socket, sessionId, messages.length]);

  // Main socket event listeners
  useEffect(() => {
    if (!socket) {
      console.log('⚠️ No socket connection available for chat interface');
      setConnectionStatus('disconnected');
      
      // Increment connection attempts
      setConnectionAttempts(prev => {
        const newCount = prev + 1;
        if (newCount > 3) {
          toast.error('Unable to connect to chat. Please try refreshing the page.');
        }
        return newCount;
      });
      
      return;
    }

    console.log('🎧 Setting up chat interface listeners for session:', sessionId);
    
    // Handle incoming messages
    const handleReceiveMessage = (message: ChatMessage) => {
      console.log('📨 Received message:', message);
      
      // Only process messages for this session
      if (message.sessionId !== sessionId) {
        console.log('⚠️ Message not for this session, ignoring');
        return;
      }
      
      setMessages(prev => {
        // Avoid duplicate messages
        const exists = prev.some(m => 
          m.timestamp === message.timestamp && 
          m.senderId === message.senderId && 
          m.content === message.content
        );
        if (exists) return prev;
        return [...prev, message];
      });
      scrollToBottom();
    };

    // Handle billing updates
    const handleBillingUpdate = (data: {
      sessionId: string;
      duration: number;
      amountBilled: number;
      currentBalance: number;
    }) => {
      if (data.sessionId !== sessionId) return;
      
      console.log('💰 Received billing update:', data);
      
      // If client and balance is getting low, show warning
      if (user?.role === 'client' && data.currentBalance < advisorRate * 3) {
        toast.error('Your balance is running low. Please add funds to continue this session.', {
          duration: 10000,
          icon: '⚠️'
        });
      }
    };

    // Handle insufficient funds
    const handleInsufficientFunds = (data: { sessionId: string }) => {
      if (data.sessionId !== sessionId) return;
      
      console.log('❌ Insufficient funds for session:', sessionId);
      setInsufficientFunds(true);
      setIsChatActive(false);
      setBillingActive(false);
      
      const systemMessage: ChatMessage = {
        sessionId,
        senderId: 'system',
        receiverId: 'all',
        content: user?.role === 'client' 
          ? 'Session ended due to insufficient funds. Please add funds to your wallet.'
          : 'Session ended because the client has insufficient funds.',
        timestamp: Date.now(),
        type: 'system'
      };
      
      setMessages(prev => [...prev, systemMessage]);
      setShowReturnButton(true);
      
      toast.error(
        user?.role === 'client'
          ? 'Your session has ended due to insufficient funds.'
          : 'The session has ended because the client has insufficient funds.',
        { duration: 10000 }
      );
      
      // Start auto-redirect timer
      setAutoRedirectTimer(10);
    };

    // Enhanced session end handler with proper termination behavior
    const handleSessionEnded = ({ endedBy, sessionId: endedSessionId }: { endedBy: string; sessionId: string }) => {
      console.log('🔚 Received session_ended event:', { endedBy, sessionId: endedSessionId, currentSessionId: sessionId });
      
      // Only handle if it's for this session
      if (endedSessionId !== sessionId) {
        console.log('⚠️ Session ended event not for this session, ignoring');
        return;
      }
      
      // Skip if session is already marked as inactive to prevent duplicate messages
      if (!isChatActive || sessionEndedBy !== null) {
        console.log('⚠️ Session already marked as inactive, skipping duplicate end message');
        return;
      }
      
      console.log('🔚 Processing session end for session:', endedSessionId, 'ended by:', endedBy);
      
      // Immediately disable chat functionality
      setIsChatActive(false);
      setBillingActive(false);
      setSessionEndedBy(endedBy);
      setShowReturnButton(true);
      
      // Clear any pending input
      setInputValue('');
      
      // Determine who ended the session for the message
      const currentUserName = user?.full_name || 'You';
      const isCurrentUser = endedBy === currentUserName || endedBy === 'You';
      
      let messageText: string;
      if (isCurrentUser) {
        messageText = 'You ended this session.';
      } else {
        // Check if it's client or advisor based on user role
        const userRole = user?.role;
        if (userRole === 'client') {
          messageText = 'This session was ended by the advisor.';
        } else if (userRole === 'advisor') {
          messageText = 'This session was ended by the client.';
        } else {
          messageText = `This session was ended by ${endedBy}.`;
        }
      }
      
      const endMessage: ChatMessage = {
        sessionId,
        senderId: 'system',
        receiverId: 'all',
        content: messageText,
        timestamp: Date.now(),
        type: 'system'
      };
      setMessages(prev => [...prev, endMessage]);
      
      // Show toast notification only if ended by other participant
      if (!isCurrentUser) {
        const userRole = user?.role;
        let notificationText: string;
        if (userRole === 'client') {
          notificationText = 'Session ended by advisor';
        } else if (userRole === 'advisor') {
          notificationText = 'Session ended by client';
        } else {
          notificationText = `Session ended by ${endedBy}`;
        }
        
        toast.info(notificationText, {
          duration: 4000,
          icon: '🔚'
        });
      }
      
      // Start auto-redirect timer (5 seconds)
      setAutoRedirectTimer(5);
    };

    // Handle advisor status change
    const handleAdvisorStatusChange = (status: boolean) => {
      if (!status) {
        toast.error('Advisor has become unavailable');
        setIsChatActive(false);
        setBillingActive(false);
        
        const statusMessage: ChatMessage = {
          sessionId,
          senderId: 'system',
          receiverId: 'all',
          content: 'The advisor has become unavailable. This session will end shortly.',
          timestamp: Date.now(),
          type: 'system'
        };
        setMessages(prev => [...prev, statusMessage]);
        
        // Auto-end session after advisor becomes unavailable
        setTimeout(() => {
          handleEndSession(false); // false = don't show confirmation
        }, 3000);
      }
    };

    // Handle chat response
    const handleChatResponse = ({ sessionId: responseSessionId, accepted }: { sessionId: string; accepted: boolean }) => {
      if (responseSessionId === sessionId) {
        if (accepted) {
          console.log('✅ Chat request was accepted');
          toast.success('Chat request accepted');
          setIsChatActive(true);
          
          // If user is advisor, start billing
          if (user?.role === 'advisor') {
            setBillingActive(true);
          }
          
          const acceptMessage: ChatMessage = {
            sessionId,
            senderId: 'system',
            receiverId: 'all',
            content: 'Your chat request has been accepted. You can now start chatting!',
            timestamp: Date.now(),
            type: 'system'
          };
          setMessages(prev => [...prev, acceptMessage]);
        } else {
          console.log('❌ Chat request was declined');
          toast.error('Chat request was declined');
          setIsChatActive(false);
          
          const declineMessage: ChatMessage = {
            sessionId,
            senderId: 'system',
            receiverId: 'all',
            content: 'Your chat request was declined by the advisor.',
            timestamp: Date.now(),
            type: 'system'
          };
          setMessages(prev => [...prev, declineMessage]);
          
          setAutoRedirectTimer(3);
        }
      }
    };

    // Handle chat rejected
    const handleChatRejected = ({ sessionId: rejectedSessionId, reason }: { sessionId: string; reason?: string }) => {
      if (rejectedSessionId === sessionId) {
        console.log('❌ Chat was rejected, reason:', reason);
        toast.error('Chat request was declined');
        setIsChatActive(false);
        
        let message = 'Your chat request was declined by the advisor.';
        if (reason === 'insufficient_funds') {
          message = 'Your chat request was declined due to insufficient funds. Please add funds to your wallet.';
          setInsufficientFunds(true);
        }
        
        const rejectMessage: ChatMessage = {
          sessionId,
          senderId: 'system',
          receiverId: 'all',
          content: message,
          timestamp: Date.now(),
          type: 'system'
        };
        setMessages(prev => [...prev, rejectMessage]);
        
        setAutoRedirectTimer(3);
      }
    };

    // Connection status handlers
    const handleConnect = () => {
      console.log('🔗 Socket connected in chat interface');
      setConnectionStatus('connected');
      socket.emit('join_room', sessionId);
    };

    const handleDisconnect = () => {
      console.log('🔌 Socket disconnected in chat interface');
      setConnectionStatus('disconnected');
      toast.error('Disconnected from chat. Attempting to reconnect...');
    };

    const handleReconnect = () => {
      console.log('🔄 Socket reconnected');
      setConnectionStatus('connected');
      socket.emit('join_room', sessionId);
      toast.success('Reconnected to chat');
    };

    // Set up event listeners
    socket.on('receive_message', handleReceiveMessage);
    socket.on('session_ended', handleSessionEnded);
    socket.on('advisor_status_change', handleAdvisorStatusChange);
    socket.on('chat_response', handleChatResponse);
    socket.on('chat_rejected', handleChatRejected);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('reconnect', handleReconnect);
    socket.on('billing_update', handleBillingUpdate);
    socket.on('insufficient_funds', handleInsufficientFunds);

    return () => {
      console.log('🧹 Cleaning up chat interface listeners');
      socket.off('receive_message', handleReceiveMessage);
      socket.off('session_ended', handleSessionEnded);
      socket.off('advisor_status_change', handleAdvisorStatusChange);
      socket.off('chat_response', handleChatResponse);
      socket.off('chat_rejected', handleChatRejected);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnect', handleReconnect);
      socket.off('billing_update', handleBillingUpdate);
      socket.off('insufficient_funds', handleInsufficientFunds);
    };
  }, [socket, sessionId, onClose, user?.full_name, user?.role, advisorRate, isChatActive, sessionEndedBy]);

  const showEndSessionConfirmation = () => {
    return new Promise<boolean>((resolve) => {
      toast.custom((t) => (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-slate-200">
          <h3 className="font-medium text-slate-900 mb-2">End Session</h3>
          <p className="text-slate-600 mb-4">Are you sure you want to end this chat session?</p>
          <div className="flex justify-end space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                toast.dismiss(t.id);
                resolve(false);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                toast.dismiss(t.id);
                resolve(true);
              }}
            >
              End Session
            </Button>
          </div>
        </div>
      ), { duration: Infinity });
    });
  };

  const handleEndSession = async (showConfirmation = true) => {
    if (!socket || isEnding) return;

    try {
      setIsEnding(true);
      
      // Show confirmation dialog if requested
      if (showConfirmation) {
        const confirmEndSession = await showEndSessionConfirmation();
        if (!confirmEndSession) {
          setIsEnding(false);
          return;
        }
      }

      console.log('🔚 Ending session:', sessionId);

      // Update session status in database first
      const { error: updateError } = await supabase
        .from('sessions')
        .update({ 
          status: 'completed',
          end_time: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (updateError) {
        console.error('❌ Error updating session status:', updateError);
        throw updateError;
      }

      console.log('✅ Session status updated in database');

      // If advisor, stop billing
      if (user?.role === 'advisor') {
        socket.emit('billing_stop', { sessionId });
      }

      // Notify other participant via socket with proper identification
      const endedByName = user?.full_name || 'Other participant';
      console.log('📢 Emitting session_ended event:', { sessionId, endedBy: endedByName });
      
      socket.emit('session_ended', {
        sessionId,
        endedBy: endedByName
      });

      // Add local system message
      const systemMessage: ChatMessage = {
        sessionId,
        senderId: 'system',
        receiverId: 'all',
        content: 'You ended this session.',
        timestamp: Date.now(),
        type: 'system'
      };
      setMessages(prev => [...prev, systemMessage]);

      // Immediately disable chat functionality
      setIsChatActive(false);
      setBillingActive(false);
      setSessionEndedBy('You');
      setShowReturnButton(true);
      setInputValue(''); // Clear any pending input
      
      toast.success('Session ended successfully');
      
      // Start auto-redirect timer
      setAutoRedirectTimer(5);
    } catch (error) {
      console.error('❌ Error ending session:', error);
      toast.error('Failed to end session');
    } finally {
      setIsEnding(false);
    }
  };

  const sendMessage = async (content: string) => {
    if (!socket || !isConnected || !content.trim() || isLoading || !isChatActive) return;
    
    setIsLoading(true);
    try {
      const message: ChatMessage = {
        sessionId,
        senderId: userId,
        receiverId: recipientId,
        content: content.trim(),
        timestamp: Date.now(),
        type: 'text'
      };

      console.log('📤 Sending message:', message);
      socket.emit('send_message', message);
      
      // Add message to local state immediately for better UX
      setMessages(prev => [...prev, message]);
      setInputValue('');
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !isChatActive) return;
    sendMessage(inputValue);
  };

  const handleReturn = () => {
    const basePath = user?.role === 'advisor' ? '/advisor-dashboard' : '/dashboard';
    navigate(basePath);
  };

  const cancelAutoRedirect = () => {
    setAutoRedirectTimer(null);
  };

  const handleInsufficientFunds = () => {
    setInsufficientFunds(true);
    setIsChatActive(false);
    setBillingActive(false);
    setShowReturnButton(true);
    
    // Start auto-redirect timer
    setAutoRedirectTimer(10);
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected - Please refresh';
      default:
        return 'Unknown';
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-green-600';
      case 'connecting':
        return 'text-yellow-600';
      case 'disconnected':
        return 'text-red-600';
      default:
        return 'text-slate-600';
    }
  };

  console.log('🎨 Rendering ChatInterface', {
    sessionId,
    userId,
    recipientId,
    isConnected,
    connectionStatus,
    messagesCount: messages.length,
    isChatActive,
    billingActive,
    sessionEndedBy,
    autoRedirectTimer
  });

  return (
    <div className="w-[960px] h-[620px] flex flex-col bg-white rounded-lg shadow-sm border border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <Avatar
            src={null}
            alt={user?.full_name || 'User'}
            size="sm"
          />
          <div>
            <h3 className="font-medium text-slate-900">Live Session</h3>
            <p className={`text-sm ${getConnectionStatusColor()}`}>
              {!isChatActive && sessionEndedBy ? 
                `Session ended by ${sessionEndedBy}` : 
                getConnectionStatusText()
              }
            </p>
          </div>
        </div>
        
        {isChatActive && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEndSession(true)}
            disabled={isEnding || connectionStatus !== 'connected'}
            className="bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
          >
            {isEnding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <X className="w-4 h-4" />
            )}
            <span className="ml-2">End Session</span>
          </Button>
        )}
      </div>

      {/* Auto-redirect notification */}
      {autoRedirectTimer !== null && autoRedirectTimer > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-blue-700">
              Returning to dashboard in {autoRedirectTimer} seconds...
            </p>
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={cancelAutoRedirect}
                className="text-xs"
              >
                Stay Here
              </Button>
              <Button
                size="sm"
                onClick={handleReturn}
                className="text-xs"
              >
                Return Now
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Session ended notification bar */}
      {!isChatActive && sessionEndedBy && (
        <div className="bg-slate-100 border-b border-slate-200 p-3">
          <div className="flex items-center justify-center">
            <p className="text-sm text-slate-700 font-medium">
              {sessionEndedBy === 'You' ? 
                'You ended this session' : 
                `This session was ended by ${sessionEndedBy === user?.full_name ? 'you' : 
                  user?.role === 'client' ? 'the advisor' : 
                  user?.role === 'advisor' ? 'the client' : 
                  sessionEndedBy}`
              }
            </p>
          </div>
        </div>
      )}

      {/* Main content area with chat and billing */}
      <div className="flex-1 flex overflow-hidden">
        {/* Messages */}
        <div 
          ref={chatContainerRef}
          className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-slate-50"
        >
          {messages.length === 0 && (
            <div className="flex justify-center items-center h-full">
              <p className="text-slate-500">Start the conversation...</p>
            </div>
          )}
          
          {messages.map((message, index) => {
            if (message.type === 'system') {
              return (
                <div key={`${message.timestamp}-${index}`} className="flex justify-center">
                  <div className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-sm max-w-md text-center">
                    {message.content}
                  </div>
                </div>
              );
            }

            const isSender = message.senderId === userId;
            return (
              <div
                key={`${message.timestamp}-${index}`}
                className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start space-x-2 max-w-[80%] ${isSender ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <Avatar
                    src={null}
                    alt={isSender ? user?.full_name || 'You' : 'Recipient'}
                    size="sm"
                  />
                  <div
                    className={`rounded-lg px-4 py-2 ${
                      isSender
                        ? 'bg-purple-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-900'
                    }`}
                  >
                    <p className="break-words">{message.content}</p>
                    <span className={`text-xs mt-1 block ${isSender ? 'text-purple-200' : 'text-slate-400'}`}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Billing sidebar - only show when chat is active */}
        {billingActive && (
          <div className="w-64 border-l border-slate-200 p-4 bg-slate-50 overflow-y-auto">
            <BillingTimer 
              sessionId={sessionId}
              isActive={billingActive}
              ratePerMinute={advisorRate}
              onInsufficientFunds={handleInsufficientFunds}
              userRole={user?.role as 'client' | 'advisor'}
            />
          </div>
        )}
      </div>

      {/* Input Form or Session Ended Message */}
      {isChatActive ? (
        <form onSubmit={handleSubmit} className="p-4 border-t border-slate-200 bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={!isConnected || isLoading || connectionStatus !== 'connected'}
            />
            <Button
              type="submit"
              disabled={!isConnected || isLoading || !inputValue.trim() || connectionStatus !== 'connected'}
              className="transition-transform active:scale-95"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          
          {connectionStatus === 'disconnected' && (
            <p className="mt-2 text-sm text-red-600">
              Connection lost. Please refresh the page to reconnect.
            </p>
          )}
        </form>
      ) : (
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <div className="text-center">
            {insufficientFunds ? (
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 mb-4">
                <p className="text-amber-800 font-medium mb-1">Insufficient Funds</p>
                <p className="text-sm text-amber-700">
                  {user?.role === 'client' 
                    ? 'Your session has ended because your wallet balance is too low. Please add funds to continue chatting with advisors.'
                    : 'This session has ended because the client has insufficient funds.'}
                </p>
                {user?.role === 'client' && (
                  <Button 
                    className="mt-3 w-full"
                    onClick={() => navigate('/dashboard/wallet?action=add_funds')}
                  >
                    Add Funds
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-slate-600 mb-2">
                {sessionEndedBy === 'You' ? 
                  'You ended this session.' :
                  `This session was ended by ${sessionEndedBy === user?.full_name ? 'you' : 
                    user?.role === 'client' ? 'the advisor' : 
                    user?.role === 'advisor' ? 'the client' : 
                    sessionEndedBy}.`
                }
              </p>
            )}
            <p className="text-sm text-slate-500">
              The chat is now read-only. No new messages can be sent.
            </p>
            <Button
              onClick={handleReturn}
              className="w-full mt-4"
            >
              Return to Dashboard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}