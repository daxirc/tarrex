import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import useSound from 'use-sound';
import Button from '../ui/Button';
import Avatar from '../ui/Avatar';
import { useSocket } from '../../contexts/SocketContext';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../lib/store';
import { checkClientBalance } from '../../lib/billing';

// Professional ring sound that loops
const PRIMARY_NOTIFICATION_SOUND = 'https://assets.mixkit.co/sfx/preview/mixkit-phone-ring-1120.mp3';
const FALLBACK_NOTIFICATION_SOUND = 'https://assets.mixkit.co/sfx/preview/mixkit-message-pop-alert-2354.mp3';

export default function IncomingChatRequestNotification() {
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const { user } = useStore();
  const [playSound, { stop }] = useSound(PRIMARY_NOTIFICATION_SOUND, {
    volume: 0.7,
    loop: true, // Loop the sound every 3-4 seconds
    onplayerror: () => {
      console.warn('⚠️ Primary notification sound failed to play, trying fallback');
      const audio = new Audio(FALLBACK_NOTIFICATION_SOUND);
      audio.volume = 0.7;
      audio.loop = true;
      audio.play().catch(e => console.warn('⚠️ Fallback sound also failed:', e));
    }
  });
  
  // Keep track of active notifications and their sounds
  const activeNotifications = useRef(new Set<string>());
  const activeSounds = useRef(new Map<string, () => void>());

  useEffect(() => {
    // Only set up notifications for approved advisors who are available
    if (!user || user.role !== 'advisor') {
      return;
    }

    // Check if advisor is approved and available
    if (!user.is_approved) {
      console.log('⚠️ Advisor not approved, skipping notifications');
      return;
    }

    const advisorProfile = user.advisor_profiles?.[0];
    if (!advisorProfile?.is_available) {
      console.log('⚠️ Advisor not available, skipping notifications');
      return;
    }

    if (!socket || !isConnected) {
      console.log('⚠️ No socket connection available for chat notifications');
      return;
    }

    console.log('🎧 Setting up chat request notification listeners for advisor...');

    const handleChatRequest = async (data: any) => {
      const { sessionId, clientName, initialMessage, advisorId, clientId, clientProfilePicture } = data;
      
      console.log('🔔 Received chat request notification:', { sessionId, clientName, initialMessage, advisorId, clientId });
      
      // Only show notification if it's for this advisor
      if (advisorId && advisorId !== user.id) {
        console.log('⚠️ Chat request not for this advisor, ignoring');
        return;
      }
      
      // Prevent duplicate notifications for the same session
      if (activeNotifications.current.has(sessionId)) {
        console.log('⚠️ Ignoring duplicate notification for session:', sessionId);
        return;
      }
      
      // Check if client has sufficient balance using the Edge Function
      try {
        console.log('🔍 Checking client balance via Edge Function for client:', clientId);
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-client-balance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            clientId,
            requiredAmount: 3
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const balanceData = await response.json();
        console.log('💰 Client balance check result:', balanceData);

        if (!balanceData.hasSufficientBalance) {
          console.log('⚠️ Client has insufficient balance, rejecting chat request');
          
          // Update session status to cancelled
          await supabase
            .from('sessions')
            .update({ status: 'cancelled' })
            .eq('id', sessionId);
            
          // Notify client
          if (socket && isConnected) {
            socket.emit('chat_response', { sessionId, accepted: false });
            socket.emit('chat_rejected', { sessionId, reason: 'insufficient_funds' });
            socket.emit('advisor_declined_chat', { sessionId, advisorId: user.id, reason: 'insufficient_funds' });
          }
          
          return;
        }
      } catch (error) {
        console.error('❌ Error checking client balance:', error);
        // Continue with notification anyway, we'll check balance again when accepting
      }
      
      activeNotifications.current.add(sessionId);
      
      // Start playing sound and store the stop function
      try {
        playSound();
        activeSounds.current.set(sessionId, stop);
      } catch (error) {
        console.warn('⚠️ Could not play notification sound:', error);
        // Try direct Audio API as fallback
        try {
          const audio = new Audio(PRIMARY_NOTIFICATION_SOUND);
          audio.volume = 0.7;
          audio.loop = true;
          audio.play();
          activeSounds.current.set(sessionId, () => {
            audio.pause();
            audio.currentTime = 0;
          });
        } catch (e) {
          console.warn('⚠️ Direct audio playback also failed:', e);
        }
      }

      toast.custom(
        (t) => (
          <div className="animate-pulse-ring animate-phone-ring flex items-start gap-4 bg-white p-6 rounded-xl shadow-2xl border-2 border-purple-200 max-w-md min-w-[400px]">
            <Avatar
              src={clientProfilePicture}
              alt={clientName || 'Client'}
              size="lg"
            />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Incoming Chat Request</h3>
              <p className="text-base text-slate-700 font-medium">From: {clientName || 'Client'}</p>
              <p className="text-sm text-slate-600 mt-2 line-clamp-2">"{initialMessage || 'New chat request'}"</p>
              <p className="text-xs text-slate-500 mt-2">{new Date().toLocaleTimeString()}</p>
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <Button
                size="sm"
                onClick={() => handleAccept(sessionId, t.id)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2"
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDecline(sessionId, t.id)}
                className="border-red-300 text-red-600 hover:bg-red-50 px-4 py-2"
              >
                Decline
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleMute(sessionId, t.id)}
                className="border-slate-300 text-slate-600 hover:bg-slate-50 px-4 py-2"
              >
                Mute
              </Button>
            </div>
          </div>
        ),
        { 
          duration: Infinity, // No auto-dismiss
          position: 'top-right',
          id: `chat-request-${sessionId}`, // Use unique ID to prevent duplicates
        }
      );
    };

    const handleMute = (sessionId: string, toastId: string) => {
      // Stop the sound but keep the notification
      const stopSound = activeSounds.current.get(sessionId);
      if (stopSound) {
        stopSound();
        activeSounds.current.delete(sessionId);
      }
      
      // Update the toast to show it's muted
      toast.custom(
        (t) => (
          <div className="flex items-start gap-4 bg-white p-6 rounded-xl shadow-2xl border-2 border-purple-200 max-w-md min-w-[400px]">
            <Avatar
              src={null}
              alt="Client"
              size="lg"
            />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Incoming Chat Request</h3>
              <p className="text-base text-slate-700 font-medium">Sound muted</p>
              <p className="text-xs text-slate-500 mt-2">{new Date().toLocaleTimeString()}</p>
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <Button
                size="sm"
                onClick={() => handleAccept(sessionId, t.id)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2"
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDecline(sessionId, t.id)}
                className="border-red-300 text-red-600 hover:bg-red-50 px-4 py-2"
              >
                Decline
              </Button>
            </div>
          </div>
        ),
        { 
          duration: Infinity,
          position: 'top-right',
          id: toastId,
        }
      );
    };

    const handleAccept = async (sessionId: string, toastId: string) => {
      try {
        console.log('✅ Accepting chat request for session:', sessionId);
        
        // Stop the sound
        const stopSound = activeSounds.current.get(sessionId);
        if (stopSound) {
          stopSound();
          activeSounds.current.delete(sessionId);
        }
        
        // Get session data to check client balance
        const { data: session, error: sessionError } = await supabase
          .from('sessions')
          .select('client_id')
          .eq('id', sessionId)
          .single();
          
        if (sessionError) throw sessionError;
        
        // Double-check client balance using Edge Function
        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-client-balance`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
              clientId: session.client_id,
              requiredAmount: 3
            })
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const balanceData = await response.json();
          
          if (!balanceData.hasSufficientBalance) {
            console.log('⚠️ Client has insufficient balance, rejecting chat request');
            
            // Update session status to cancelled
            await supabase
              .from('sessions')
              .update({ status: 'cancelled' })
              .eq('id', sessionId);
              
            // Notify client
            if (socket && isConnected) {
              socket.emit('chat_response', { sessionId, accepted: false });
              socket.emit('chat_rejected', { sessionId, reason: 'insufficient_funds' });
              socket.emit('advisor_declined_chat', { sessionId, advisorId: user.id, reason: 'insufficient_funds' });
            }
            
            toast.dismiss(toastId);
            toast.error('Client has insufficient balance. Session cannot be started.');
            
            // Remove from active notifications
            activeNotifications.current.delete(sessionId);
            return;
          }
        } catch (error) {
          console.error('❌ Error checking client balance:', error);
          // Continue anyway, but log the error
        }

        // Update session status to in_progress
        const { error } = await supabase
          .from('sessions')
          .update({ 
            status: 'in_progress',
            start_time: new Date().toISOString()
          })
          .eq('id', sessionId);

        if (error) throw error;

        // Emit acceptance response
        if (socket && isConnected) {
          socket.emit('chat_response', { sessionId, accepted: true });
          socket.emit('advisor_accepted_chat', { sessionId, advisorId: user.id });
          
          // Start billing
          socket.emit('billing_start', {
            sessionId,
            advisorId: user.id,
            clientId: session.client_id // Now we have the client ID from the session
          });
        } else {
          console.warn('⚠️ Socket not connected, cannot send acceptance');
        }
        
        toast.dismiss(toastId);
        toast.success('Chat request accepted');
        
        // Remove from active notifications
        activeNotifications.current.delete(sessionId);
        
        // Navigate to the live session
        navigate(`/advisor-dashboard/live-session/${sessionId}`);
      } catch (error) {
        console.error('❌ Error accepting chat:', error);
        toast.error('Failed to accept chat');
        activeNotifications.current.delete(sessionId);
      }
    };

    const handleDecline = async (sessionId: string, toastId: string) => {
      try {
        console.log('❌ Declining chat request for session:', sessionId);
        
        // Stop the sound
        const stopSound = activeSounds.current.get(sessionId);
        if (stopSound) {
          stopSound();
          activeSounds.current.delete(sessionId);
        }
        
        // Update session status to cancelled
        const { error } = await supabase
          .from('sessions')
          .update({ status: 'cancelled' })
          .eq('id', sessionId);

        if (error) throw error;

        // Emit decline response
        if (socket && isConnected) {
          socket.emit('chat_response', { sessionId, accepted: false });
          socket.emit('chat_rejected', { sessionId });
          socket.emit('advisor_declined_chat', { sessionId, advisorId: user.id });
        } else {
          console.warn('⚠️ Socket not connected, cannot send rejection');
        }
        
        toast.dismiss(toastId);
        toast.success('Chat request declined');
        
        // Remove from active notifications
        activeNotifications.current.delete(sessionId);
      } catch (error) {
        console.error('❌ Error declining chat:', error);
        toast.error('Failed to decline chat');
        activeNotifications.current.delete(sessionId);
      }
    };

    // Listen for chat request notifications with multiple event names for compatibility
    const eventNames = [
      'chat_request_notification',
      'chat_request',
      'new_chat_request',
      'incoming_chat_request'
    ];

    eventNames.forEach(eventName => {
      socket.on(eventName, handleChatRequest);
    });
    
    // Also listen for local pending session events
    socket.on('local_pending_session', handleChatRequest);
    
    return () => {
      console.log('🧹 Cleaning up chat request notification listeners');
      eventNames.forEach(eventName => {
        socket.off(eventName, handleChatRequest);
      });
      socket.off('local_pending_session', handleChatRequest);
      
      // Stop all sounds and clear active notifications on unmount
      activeSounds.current.forEach(stopSound => stopSound());
      activeSounds.current.clear();
      activeNotifications.current.clear();
    };
  }, [socket, navigate, playSound, stop, isConnected, user]);

  // Set up real-time database subscription for pending sessions
  useEffect(() => {
    if (!user || user.role !== 'advisor') {
      return;
    }

    console.log('📡 Setting up real-time database subscription for pending sessions...');

    const subscription = supabase
      .channel('pending_sessions_realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'sessions',
        filter: `advisor_id=eq.${user.id} AND status=eq.pending_advisor_approval`
      }, async (payload) => {
        console.log('📊 New pending session detected in database:', payload);
        
        const session = payload.new;
        
        // Fetch client name
        const { data: clientData } = await supabase
          .from('users')
          .select('full_name, id')
          .eq('id', session.client_id)
          .single();

        // Check if client has sufficient balance using Edge Function
        if (clientData?.id) {
          try {
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-client-balance`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
              },
              body: JSON.stringify({
                clientId: clientData.id,
                requiredAmount: 3
              })
            });

            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            const balanceData = await response.json();
            
            if (!balanceData.hasSufficientBalance) {
              console.log('⚠️ Client has insufficient balance, auto-rejecting chat request');
              
              // Update session status to cancelled
              await supabase
                .from('sessions')
                .update({ status: 'cancelled' })
                .eq('id', session.id);
                
              // Notify client if socket is connected
              if (socket && isConnected) {
                socket.emit('chat_response', { sessionId: session.id, accepted: false });
                socket.emit('chat_rejected', { sessionId: session.id, reason: 'insufficient_funds' });
              }
              
              return;
            }
          } catch (error) {
            console.error('❌ Error checking client balance:', error);
            // Continue with notification anyway, we'll check balance again when accepting
          }
        }

        // Trigger notification
        const notificationData = {
          sessionId: session.id,
          clientId: session.client_id,
          clientName: clientData?.full_name || 'Client',
          initialMessage: 'New chat request',
          advisorId: session.advisor_id
        };

        console.log('🔔 Triggering notification from database event:', notificationData);
        
        // Prevent duplicate notifications
        if (!activeNotifications.current.has(session.id)) {
          // If socket is connected, emit a local event to trigger the notification system
          if (socket && isConnected) {
            socket.emit('local_pending_session', notificationData);
          } else {
            // Otherwise, handle it directly
            activeNotifications.current.add(session.id);
            
            try {
              playSound();
              activeSounds.current.set(session.id, stop);
            } catch (error) {
              console.warn('⚠️ Could not play notification sound:', error);
            }

            toast.custom(
              (t) => (
                <div className="animate-pulse-ring animate-phone-ring flex items-start gap-4 bg-white p-6 rounded-xl shadow-2xl border-2 border-purple-200 max-w-md min-w-[400px]">
                  <Avatar
                    src={null}
                    alt={notificationData.clientName}
                    size="lg"
                  />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">Incoming Chat Request</h3>
                    <p className="text-base text-slate-700 font-medium">From: {notificationData.clientName}</p>
                    <p className="text-sm text-slate-600 mt-2 line-clamp-2">"{notificationData.initialMessage}"</p>
                    <p className="text-xs text-slate-500 mt-2">{new Date().toLocaleTimeString()}</p>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      onClick={() => navigate('/advisor-dashboard/sessions')}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2"
                    >
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const stopSound = activeSounds.current.get(session.id);
                        if (stopSound) {
                          stopSound();
                          activeSounds.current.delete(session.id);
                        }
                        toast.dismiss(t.id);
                        activeNotifications.current.delete(session.id);
                      }}
                      className="border-slate-300 text-slate-600 hover:bg-slate-50 px-4 py-2"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              ),
              { 
                duration: Infinity,
                position: 'top-right',
                id: `db-chat-request-${session.id}`,
              }
            );
          }
        }
      })
      .subscribe();

    return () => {
      console.log('🧹 Cleaning up database subscription');
      subscription.unsubscribe();
    };
  }, [user, playSound, stop, navigate, socket, isConnected]);

  return null;
}