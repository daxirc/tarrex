import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { Loader2, Calendar, Download, DollarSign, TrendingUp, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface EarningsData {
  totalRevenue: number;
  platformCut: number;
  advisorPayouts: number;
  totalSessions: number;
  averageSessionValue: number;
}

interface AdvisorEarnings {
  advisor: {
    id: string;
    full_name: string;
  };
  totalEarnings: number;
  sessionCount: number;
  averagePerSession: number;
}

export default function EarningsReports() {
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [earningsData, setEarningsData] = useState<EarningsData>({
    totalRevenue: 0,
    platformCut: 0,
    advisorPayouts: 0,
    totalSessions: 0,
    averageSessionValue: 0
  });
  const [advisorEarnings, setAdvisorEarnings] = useState<AdvisorEarnings[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchEarningsData();
  }, [startDate, endDate]);

  const fetchEarningsData = async () => {
    try {
      setIsLoading(true);

      // Get system settings for commission rate
      const { data: settings, error: settingsError } = await supabase
        .from('system_settings')
        .select('default_commission_rate')
        .single();

      if (settingsError) throw settingsError;

      const commissionRate = settings?.default_commission_rate || 0.2; // Default to 20%

      // Fetch completed sessions within date range
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select(`
          id,
          amount,
          advisor:advisor_id (
            id,
            full_name
          )
        `)
        .eq('status', 'completed')
        .gte('start_time', startOfDay(new Date(startDate)).toISOString())
        .lte('start_time', endOfDay(new Date(endDate)).toISOString());

      if (sessionsError) throw sessionsError;

      // Calculate overall earnings data
      const totalRevenue = sessions?.reduce((sum, session) => sum + (session.amount || 0), 0) || 0;
      const platformCut = totalRevenue * commissionRate;
      const advisorPayouts = totalRevenue - platformCut;

      setEarningsData({
        totalRevenue,
        platformCut,
        advisorPayouts,
        totalSessions: sessions?.length || 0,
        averageSessionValue: sessions?.length ? totalRevenue / sessions.length : 0
      });

      // Calculate per-advisor earnings
      const advisorStats = new Map<string, {
        full_name: string;
        earnings: number;
        sessions: number;
      }>();

      sessions?.forEach(session => {
        const advisorId = session.advisor.id;
        const current = advisorStats.get(advisorId) || {
          full_name: session.advisor.full_name,
          earnings: 0,
          sessions: 0
        };

        advisorStats.set(advisorId, {
          ...current,
          earnings: current.earnings + (session.amount || 0) * (1 - commissionRate),
          sessions: current.sessions + 1
        });
      });

      const advisorEarningsData = Array.from(advisorStats.entries()).map(([id, stats]) => ({
        advisor: {
          id,
          full_name: stats.full_name
        },
        totalEarnings: stats.earnings,
        sessionCount: stats.sessions,
        averagePerSession: stats.earnings / stats.sessions
      }));

      // Sort by total earnings descending
      advisorEarningsData.sort((a, b) => b.totalEarnings - a.totalEarnings);

      setAdvisorEarnings(advisorEarningsData);
    } catch (error) {
      console.error('Error fetching earnings data:', error);
      toast.error('Failed to load earnings data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);

      // Create CSV content
      const csvContent = [
        // Headers
        ['Report Period', `${startDate} to ${endDate}`].join(','),
        ['Generated At', format(new Date(), 'yyyy-MM-dd HH:mm:ss')].join(','),
        [''],
        ['Overall Statistics'].join(','),
        ['Total Revenue', 'Platform Cut', 'Advisor Payouts', 'Total Sessions', 'Average Session Value'].join(','),
        [
          earningsData.totalRevenue.toFixed(2),
          earningsData.platformCut.toFixed(2),
          earningsData.advisorPayouts.toFixed(2),
          earningsData.totalSessions,
          earningsData.averageSessionValue.toFixed(2)
        ].join(','),
        [''],
        ['Advisor Earnings'].join(','),
        ['Advisor Name', 'Total Earnings', 'Number of Sessions', 'Average Per Session'].join(','),
        ...advisorEarnings.map(advisor => [
          advisor.advisor.full_name,
          advisor.totalEarnings.toFixed(2),
          advisor.sessionCount,
          advisor.averagePerSession.toFixed(2)
        ].join(','))
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `earnings_report_${startDate}_to_${endDate}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Report exported successfully');
    } catch (error) {
      console.error('Error exporting report:', error);
      toast.error('Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-slate-600">Loading earnings data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              icon={<Calendar className="w-5 h-5" />}
            />
            <FormField
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              icon={<Calendar className="w-5 h-5" />}
            />
          </div>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isExporting}
            className="whitespace-nowrap"
          >
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export Report'}
          </Button>
        </div>
      </Card>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-green-100">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-600">Total Revenue</p>
              <p className="text-2xl font-semibold text-slate-900">
                ${earningsData.totalRevenue.toFixed(2)}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-purple-100">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-600">Platform Commission</p>
              <p className="text-2xl font-semibold text-slate-900">
                ${earningsData.platformCut.toFixed(2)}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-blue-100">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-600">Advisor Payouts</p>
              <p className="text-2xl font-semibold text-slate-900">
                ${earningsData.advisorPayouts.toFixed(2)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Advisor Earnings Table */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Advisor Earnings</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4">Advisor</th>
                <th className="text-right py-3 px-4">Sessions</th>
                <th className="text-right py-3 px-4">Total Earnings</th>
                <th className="text-right py-3 px-4">Avg. per Session</th>
              </tr>
            </thead>
            <tbody>
              {advisorEarnings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-600">
                    No earnings data for the selected period
                  </td>
                </tr>
              ) : (
                advisorEarnings.map((advisor) => (
                  <tr key={advisor.advisor.id} className="border-b border-slate-100">
                    <td className="py-3 px-4">{advisor.advisor.full_name}</td>
                    <td className="py-3 px-4 text-right">{advisor.sessionCount}</td>
                    <td className="py-3 px-4 text-right">
                      ${advisor.totalEarnings.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      ${advisor.averagePerSession.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}