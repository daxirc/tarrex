import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import Button from '../../components/ui/Button';
import ChatInterface from '../../components/chat/ChatInterface';
import { useSocket } from '../../contexts/SocketContext';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';

export default function LiveSession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user, isLoading: isUserLoading } = useStore();
  const { connect, disconnect, isConnected } = useSocket();
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const fetchSession = useCallback(async () => {
    if (!sessionId || !user?.id) return null;
    
    try {
      console.log('🔍 Fetching session data for:', sessionId);
      const { data, error } = await supabase
        .from('sessions')
        .select('client_id, advisor_id, status, type')
        .eq('id', sessionId)
        .single();
        
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Error fetching session:', error);
      return null;
    }
  }, [sessionId, user?.id]);

  useEffect(() => {
    console.log('🎯 LiveSession useEffect triggered', {
      sessionId,
      user: user?.id,
      isUserLoading,
      userRole: user?.role,
      isConnected
    });

    if (!sessionId) {
      console.error('❌ No session ID provided');
      setError('No session ID provided');
      setIsSessionLoading(false);
      return;
    }

    if (isUserLoading) {
      console.log('⏳ User data still loading...');
      return;
    }

    if (!user) {
      console.error('❌ No user data available');
      setError('User not authenticated');
      setIsSessionLoading(false);
      return;
    }

    const setupSession = async () => {
      try {
        setIsSessionLoading(true);
        setError(null);
        console.log('🎯 Setting up live session for', user.role, 'in session:', sessionId);

        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Session setup timeout')), 20000);
        });

        const sessionPromise = fetchSession();

        const session = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as any;

        if (!session) {
          throw new Error('Failed to fetch session data');
        }

        console.log('📊 Session data fetched:', session);
        
        // Validate user access
        if (user.id !== session.client_id && user.id !== session.advisor_id) {
          console.error('❌ Unauthorized access to session');
          throw new Error('You are not authorized to access this session');
        }

        // Determine recipient
        const recipient = user.id === session.client_id ? session.advisor_id : session.client_id;
        console.log('👤 Recipient determined:', recipient);
        
        setRecipientId(recipient);
        setSessionData(session);

        // Connect to socket
        console.log('🔗 Connecting to session:', sessionId, 'as', user.role);
        connect(sessionId, user.role as 'client' | 'advisor');

      } catch (error) {
        console.error('❌ Error setting up session:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to set up chat session';
        setError(errorMessage);
        
        // Only show toast for non-timeout errors to avoid duplicate messages
        if (!(error instanceof Error) || !error.message.includes('timeout')) {
          toast.error(errorMessage);
        }
        
        // Increment retry count
        setRetryCount(prev => prev + 1);
        
        // Auto-retry up to 3 times
        if (retryCount < 3) {
          console.log(`🔄 Auto-retrying setup (attempt ${retryCount + 1}/3)...`);
          setTimeout(() => {
            setupSession();
          }, 2000);
        }
      } finally {
        setIsSessionLoading(false);
      }
    };

    setupSession();

    return () => {
      console.log('🧹 Cleaning up live session...');
      disconnect();
    };
  }, [sessionId, user, isUserLoading, connect, disconnect, fetchSession, retryCount]);

  const handleClose = () => {
    const basePath = user?.role === 'advisor' ? '/advisor-dashboard' : '/dashboard';
    navigate(basePath);
  };

  const handleReturn = () => {
    const basePath = user?.role === 'advisor' ? '/advisor-dashboard' : '/dashboard';
    navigate(basePath);
  };

  const handleRetry = () => {
    setError(null);
    setIsSessionLoading(true);
    setRetryCount(0);
    // Force reconnection
    disconnect();
    setTimeout(() => {
      if (user) {
        connect(sessionId!, user.role as 'client' | 'advisor');
      }
    }, 1000);
  };

  console.log('🎨 Rendering LiveSession component', {
    isUserLoading,
    isSessionLoading,
    sessionId,
    userId: user?.id,
    recipientId,
    sessionData,
    error,
    isConnected
  });

  // Show loading state
  if (isUserLoading || isSessionLoading) {
    console.log('⏳ Showing loading state');
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-4" />
          <span className="text-slate-600">
            {isUserLoading ? 'Loading user data...' : 'Setting up chat session...'}
          </span>
          <div className="mt-4">
            <Button variant="outline" onClick={handleReturn}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    console.log('❌ Showing error state:', error);
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Session Error</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={handleRetry}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            <Button variant="outline" onClick={handleReturn}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show missing data error
  if (!sessionId || !user || !recipientId) {
    console.log('❌ Missing required data, showing error state');
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <div className="text-center max-w-md mx-auto p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Invalid Session</h2>
          <p className="text-slate-600 mb-6">
            Missing required session data. Please try starting a new session.
          </p>
          <Button onClick={handleReturn}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  console.log('✅ Rendering ChatInterface');
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50">
      <div className="flex-1 flex items-center justify-center p-4">
        <ChatInterface
          sessionId={sessionId}
          userId={user.id}
          recipientId={recipientId}
          onClose={handleClose}
        />
      </div>
    </div>
  );
}