import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { Loader2, FileText, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface KycDocument {
  id: string;
  user: {
    id: string;
    full_name: string;
    email: string;
  };
  document_type: 'passport' | 'drivers_license' | 'national_id' | 'proof_of_address';
  document_number: string;
  document_url: string;
  expiry_date: string | null;
  verification_status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  verified_at: string | null;
  created_at: string;
}

export default function KycRequests() {
  const [documents, setDocuments] = useState<KycDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchKycDocuments();
  }, []);

  const fetchKycDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('kyc_documents')
        .select(`
          id,
          document_type,
          document_number,
          document_url,
          expiry_date,
          verification_status,
          rejection_reason,
          verified_at,
          created_at,
          user:user_id (
            id,
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching KYC documents:', error);
      toast.error('Failed to load KYC documents');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (documentId: string, newStatus: 'approved' | 'rejected') => {
    if (isProcessing) return;

    if (newStatus === 'rejected' && !notes.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    try {
      setIsProcessing(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user found');

      const { error } = await supabase
        .from('kyc_documents')
        .update({
          verification_status: newStatus,
          rejection_reason: newStatus === 'rejected' ? notes.trim() : null,
          verified_at: new Date().toISOString(),
          verified_by: user.id
        })
        .eq('id', documentId);

      if (error) throw error;

      toast.success(`KYC document ${newStatus}`);
      fetchKycDocuments();
      setSelectedDocument(null);
      setNotes('');
    } catch (error) {
      console.error('Error updating KYC document:', error);
      toast.error('Failed to update KYC document');
    } finally {
      setIsProcessing(false);
    }
  };

  const getDocumentTypeLabel = (type: KycDocument['document_type']) => {
    switch (type) {
      case 'passport':
        return 'Passport';
      case 'drivers_license':
        return "Driver's License";
      case 'national_id':
        return 'National ID Card';
      case 'proof_of_address':
        return 'Proof of Address';
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-slate-600">Loading KYC documents...</span>
      </div>
    );
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-900 mb-6">KYC Document Verification</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-3 px-4">Advisor</th>
              <th className="text-left py-3 px-4">Document Type</th>
              <th className="text-left py-3 px-4">Document Number</th>
              <th className="text-left py-3 px-4">Submitted</th>
              <th className="text-center py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Notes</th>
              <th className="text-right py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-600">
                  No KYC documents found
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <tr key={doc.id} className="border-b border-slate-100">
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium text-slate-900">{doc.user.full_name}</p>
                      <p className="text-sm text-slate-500">{doc.user.email}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <span>{getDocumentTypeLabel(doc.document_type)}</span>
                      <a
                        href={doc.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-600 hover:text-purple-700"
                      >
                        <FileText className="w-4 h-4" />
                      </a>
                    </div>
                  </td>
                  <td className="py-3 px-4">{doc.document_number}</td>
                  <td className="py-3 px-4">
                    {format(new Date(doc.created_at), 'MMM d, yyyy')}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        doc.verification_status === 'approved'
                          ? 'bg-green-100 text-green-700'
                          : doc.verification_status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {doc.verification_status.charAt(0).toUpperCase() + doc.verification_status.slice(1)}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {doc.rejection_reason || '-'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {doc.verification_status === 'pending' && (
                      selectedDocument === doc.id ? (
                        <div className="space-y-4">
                          <FormField
                            label="Notes"
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Required for rejection"
                          />
                          <div className="flex justify-end space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedDocument(null);
                                setNotes('');
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleStatusUpdate(doc.id, 'approved')}
                              disabled={isProcessing}
                              className="flex items-center"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              {isProcessing ? 'Processing...' : 'Approve'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusUpdate(doc.id, 'rejected')}
                              disabled={isProcessing}
                              className="border-red-300 text-red-600 hover:bg-red-50 flex items-center"
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => setSelectedDocument(doc.id)}
                        >
                          Review
                        </Button>
                      )
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}