import { useState } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import FormField from '../components/ui/FormField';
import { MessageSquare, Clock } from 'lucide-react';

export default function Support() {
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);

  const tickets = [
    {
      id: '1',
      subject: 'Payment Issue',
      message: 'I was charged twice for my last session',
      status: 'open',
      createdAt: '2024-03-15T10:30:00Z'
    },
    {
      id: '2',
      subject: 'Technical Problem',
      message: 'Video call not working properly',
      status: 'in-progress',
      createdAt: '2024-03-14T15:45:00Z'
    }
  ];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Support</h1>
          <p className="text-slate-600">Get help with your account or sessions</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* New Ticket Form */}
          <div className="lg:col-span-2">
            <Card>
              <h2 className="text-lg font-semibold text-slate-900 mb-6">Create New Ticket</h2>
              <form className="space-y-6">
                <FormField
                  label="Subject"
                  type="text"
                  required
                  placeholder="Brief description of your issue"
                />

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-700">
                    Message
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <textarea
                    rows={5}
                    className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm"
                    placeholder="Describe your issue in detail"
                    required
                  />
                </div>

                <Button type="submit">Submit Ticket</Button>
              </form>
            </Card>
          </div>

          {/* Ticket List */}
          <div className="lg:col-span-1">
            <Card>
              <h2 className="text-lg font-semibold text-slate-900 mb-6">Recent Tickets</h2>
              <div className="space-y-4">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className={`p-4 rounded-lg border ${
                      selectedTicket === ticket.id
                        ? 'border-purple-200 bg-purple-50'
                        : 'border-slate-200 hover:border-purple-200'
                    } cursor-pointer transition-colors`}
                    onClick={() => setSelectedTicket(ticket.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-slate-900">{ticket.subject}</h3>
                        <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                          {ticket.message}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          ticket.status === 'open'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {ticket.status}
                      </span>
                    </div>
                    <div className="flex items-center mt-3 text-sm text-slate-500">
                      <Clock className="w-4 h-4 mr-1" />
                      <time dateTime={ticket.createdAt}>
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </time>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-8">
          <Card>
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <MessageSquare className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Need Immediate Help?</h2>
                <p className="text-slate-600 mt-1">
                  Check our FAQ section or contact us directly for urgent matters
                </p>
                <div className="mt-4 space-x-4">
                  <Button variant="outline">View FAQ</Button>
                  <Button>Contact Us</Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}