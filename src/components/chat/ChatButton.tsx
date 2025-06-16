import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import Button from '../ui/Button';
import { MessageSquare, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSocket } from '../../contexts/SocketContext';
import { checkClientBalance } from '../../lib/billing';

interface ChatButtonProps {
  advisorId: string;
  isAdvisorAvailable: boolean;
  initialMessage: string;
}

export default function ChatButton({ advisorId, isAdvisorAvailable, initialMessage }: ChatButtonProps) {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [isChecking, setIsChecking] = useState(false);

  const handleClick = async () => {
    if (!initialMessage.trim()) {
      toast.error('Please enter a message to start the chat');
      return;
    }

    setIsChecking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate(`/login?redirect=/advisor/${advisorId}`);
        return;
      }

      if (!isAdvisorAvailable) {
        toast.error('Advisor is currently unavailable');
        return;
      }

      // Check if client has sufficient balance (minimum $3) using Edge Function
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-client-balance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            clientId: user.id,
            requiredAmount: 3
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const balanceData = await response.json();
        
        if (!balanceData.hasSufficientBalance) {
          toast.error('Insufficient balance. Please add funds to your wallet before starting a chat session.');
          navigate('/dashboard/wallet?action=add_funds');
          return;
        }
      } catch (error) {
        console.error('Error checking client balance:', error);
        toast.error('Failed to verify your balance. Please try again.');
        return;
      }

      console.log('🎯 Creating new chat session...');

      // Create a session in pending state
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          client_id: user.id,
          advisor_id: advisorId,
          type: 'chat',
          status: 'pending_advisor_approval',
          start_time: new Date().toISOString()
        })
        .select()
        .single();

      if (sessionError) {
        console.error('❌ Session creation error:', sessionError);
        throw sessionError;
      }

      console.log('✅ Session created:', session);

      // Get client data for the notification (removed profile_picture since it doesn't exist in users table)
      const { data: clientData, error: clientError } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (clientError) {
        console.error('❌ Client data fetch error:', clientError);
        throw clientError;
      }

      // Emit chat request notification with initial message
      console.log('📢 Sending chat request notification to advisor...');
      
      if (socket) {
        // Send both event types to ensure compatibility
        socket.emit('chat_request', {
          sessionId: session.id,
          clientId: user.id,
          advisorId,
          clientName: clientData.full_name || 'Anonymous',
          clientProfilePicture: null, // Set to null since profile_picture doesn't exist in users table
          initialMessage
        });
        
        socket.emit('chat_request_notification', {
          sessionId: session.id,
          clientId: user.id,
          advisorId,
          clientName: clientData.full_name || 'Anonymous',
          clientProfilePicture: null, // Set to null since profile_picture doesn't exist in users table
          initialMessage
        });
        
        console.log('✅ Notification sent via socket');
      } else {
        console.warn('⚠️ No socket connection available for notification');
        // Continue anyway since the advisor will see the pending session
      }

      // Navigate to the chat session immediately
      console.log('🚀 Navigating to live session...');
      navigate(`/dashboard/live-session/${session.id}`);

    } catch (error) {
      console.error('❌ Error starting chat:', error);
      toast.error('Failed to start chat session');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isChecking || !isAdvisorAvailable}
      className="w-full flex items-center justify-center"
    >
      {isChecking ? (
        <>
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          Starting chat...
        </>
      ) : (
        <>
          <MessageSquare className="w-5 h-5 mr-2" />
          {isAdvisorAvailable ? 'Start Chat' : 'Unavailable'}
        </>
      )}
    </Button>
  );
}