import { useState, useEffect } from 'react';
import { Clock, DollarSign, AlertTriangle, Play } from 'lucide-react';
import { useSocket } from '../../contexts/SocketContext';
import Button from '../ui/Button';

interface BillingTimerProps {
  sessionId: string;
  isActive: boolean;
  ratePerMinute: number;
  onInsufficientFunds?: () => void;
  userRole: 'client' | 'advisor';
  showStartChargingButton?: boolean;
  onBillingStartRequest?: () => void;
}

export default function BillingTimer({
  sessionId,
  isActive,
  ratePerMinute,
  onInsufficientFunds,
  userRole,
  showStartChargingButton = false,
  onBillingStartRequest
}: BillingTimerProps) {
  const { socket } = useSocket();
  const [duration, setDuration] = useState(0); // in seconds
  const [totalBilled, setTotalBilled] = useState(0);
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [lowBalanceWarning, setLowBalanceWarning] = useState(false);
  const [lastBillingUpdate, setLastBillingUpdate] = useState<Date | null>(null);
  const [isRequestingBillingStart, setIsRequestingBillingStart] = useState(false);

  // Format duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Format money values
  const formatMoney = (amount: number): string => {
    return `$${amount.toFixed(2)}`;
  };

  // Calculate estimated time remaining based on current balance
  const calculateTimeRemaining = (): string => {
    if (currentBalance === null || ratePerMinute <= 0) return '--:--';
    
    const minutesRemaining = Math.floor(currentBalance / ratePerMinute);
    const secondsRemaining = minutesRemaining * 60;
    
    return formatDuration(secondsRemaining);
  };

  // Set up socket listeners for billing updates
  useEffect(() => {
    if (!socket || !isActive) return;

    const handleBillingUpdate = (data: {
      sessionId: string;
      duration: number;
      amountBilled: number;
      currentBalance: number;
    }) => {
      if (data.sessionId !== sessionId) return;
      
      setDuration(data.duration);
      setTotalBilled(data.amountBilled);
      setCurrentBalance(data.currentBalance);
      setLastBillingUpdate(new Date());
      
      // Check if balance is getting low (less than 3 minutes remaining)
      if (data.currentBalance < ratePerMinute * 3) {
        setLowBalanceWarning(true);
      } else {
        setLowBalanceWarning(false);
      }
    };

    const handleInsufficientFunds = (data: { sessionId: string }) => {
      if (data.sessionId !== sessionId) return;
      
      if (onInsufficientFunds) {
        onInsufficientFunds();
      }
    };

    const handleBillingStarted = (data: { sessionId: string }) => {
      if (data.sessionId !== sessionId) return;
      setIsRequestingBillingStart(false);
    };

    socket.on('billing_update', handleBillingUpdate);
    socket.on('insufficient_funds', handleInsufficientFunds);
    socket.on('billing_started', handleBillingStarted);

    return () => {
      socket.off('billing_update', handleBillingUpdate);
      socket.off('insufficient_funds', handleInsufficientFunds);
      socket.off('billing_started', handleBillingStarted);
    };
  }, [socket, sessionId, isActive, ratePerMinute, onInsufficientFunds]);

  // Local timer for UI updates between server updates
  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive]);

  const handleRequestBillingStart = () => {
    if (onBillingStartRequest) {
      setIsRequestingBillingStart(true);
      onBillingStartRequest();
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center text-slate-700">
          <Clock className="w-5 h-5 mr-2 text-purple-600" />
          <span className="font-medium">Session Timer</span>
        </div>
        <div className="text-lg font-bold text-slate-900">
          {formatDuration(duration)}
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Rate:</span>
          <span className="font-medium text-slate-900">{formatMoney(ratePerMinute)}/min</span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Total billed:</span>
          <span className="font-medium text-slate-900">{formatMoney(totalBilled)}</span>
        </div>
        
        {userRole === 'client' && currentBalance !== null && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Current balance:</span>
              <span className="font-medium text-slate-900">{formatMoney(currentBalance)}</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Est. time remaining:</span>
              <span className="font-medium text-slate-900">{calculateTimeRemaining()}</span>
            </div>
          </>
        )}
      </div>
      
      {/* Start Charging Button for Advisors */}
      {userRole === 'advisor' && showStartChargingButton && !isActive && (
        <div className="mt-3">
          <Button 
            onClick={handleRequestBillingStart}
            disabled={isRequestingBillingStart}
            className="w-full"
          >
            <Play className="w-4 h-4 mr-2" />
            {isRequestingBillingStart ? 'Requesting...' : 'Start Charging'}
          </Button>
        </div>
      )}
      
      {lowBalanceWarning && userRole === 'client' && (
        <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-md flex items-start">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 mr-2 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            Your balance is running low. Please add funds to continue this session.
          </p>
        </div>
      )}
      
      {lastBillingUpdate && (
        <div className="mt-3 text-xs text-slate-500 text-right">
          Last updated: {lastBillingUpdate.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}