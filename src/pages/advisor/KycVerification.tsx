import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { FileUp, Loader2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../lib/store';

interface KycDocument {
  id: string;
  document_type: 'passport' | 'drivers_license' | 'national_id' | 'proof_of_address';
  document_number: string;
  document_url: string;
  expiry_date: string | null;
  verification_status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  verified_at: string | null;
}

const KycUploadForm = ({ onSuccess }: { onSuccess: () => void }) => {
  const { user } = useStore();
  const [formData, setFormData] = useState({
    documentType: '',
    documentNumber: '',
    expiryDate: '',
    file: null as File | null
  });
  
  const uploadMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!user?.id || !data.file) throw new Error('Missing required data');

      const fileExt = data.file.name.split('.').pop();
      const fileName = `${user.id}/${data.documentType}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('kyc-documents')
        .upload(fileName, data.file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('kyc-documents')
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from('kyc_documents')
        .insert({
          user_id: user.id,
          document_type: data.documentType,
          document_number: data.documentNumber,
          expiry_date: data.expiryDate || null,
          document_url: publicUrl,
          verification_status: 'pending'
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast.success('Document submitted successfully');
      onSuccess();
    },
    onError: (error) => {
      console.error('Error uploading document:', error);
      toast.error('Failed to upload document');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    uploadMutation.mutate(formData);
  };

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-6">
        <FormField
          label="Document Type"
          type="select"
          value={formData.documentType}
          onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
          required
          options={[
            { value: 'passport', label: 'Passport' },
            { value: 'drivers_license', label: "Driver's License" },
            { value: 'national_id', label: 'National ID' },
            { value: 'proof_of_address', label: 'Proof of Address' }
          ]}
        />

        <FormField
          label="Document Number"
          type="text"
          value={formData.documentNumber}
          onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
          required
        />

        <FormField
          label="Expiry Date"
          type="date"
          value={formData.expiryDate}
          onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
          min={new Date().toISOString().split('T')[0]}
        />

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            Upload Document
            <span className="text-red-500 ml-1">*</span>
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg">
            <div className="space-y-1 text-center">
              <FileUp className="mx-auto h-12 w-12 text-slate-400" />
              <div className="flex text-sm text-slate-600">
                <label className="relative cursor-pointer rounded-md font-medium text-purple-600 hover:text-purple-500">
                  <span>Upload a file</span>
                  <input
                    type="file"
                    className="sr-only"
                    accept="image/*,.pdf"
                    onChange={(e) => setFormData({ ...formData, file: e.target.files?.[0] || null })}
                    required
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-slate-500">PNG, JPG, or PDF up to 5MB</p>
            </div>
          </div>
        </div>

        <Button
          type="submit"
          disabled={uploadMutation.isPending}
          className="w-full"
        >
          {uploadMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            'Submit Document'
          )}
        </Button>
      </form>
    </Card>
  );
};

const KycStatus = ({ status }: { status: string }) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-6 h-6 text-red-600" />;
      case 'pending':
        return <Loader2 className="w-6 h-6 text-yellow-600 animate-spin" />;
      default:
        return <AlertTriangle className="w-6 h-6 text-slate-600" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'approved':
        return 'bg-green-50 border-green-200';
      case 'rejected':
        return 'bg-red-50 border-red-200';
      case 'pending':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  return (
    <Card className={getStatusColor()}>
      <div className="flex items-center space-x-4">
        <div className={`p-3 rounded-lg ${status === 'approved' ? 'bg-green-100' : status === 'rejected' ? 'bg-red-100' : 'bg-yellow-100'}`}>
          {getStatusIcon()}
        </div>
        <div>
          <h3 className="font-medium text-slate-900">
            {status === 'approved' && 'KYC Verification Complete'}
            {status === 'rejected' && 'Verification Failed'}
            {status === 'pending' && 'Verification in Progress'}
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            {status === 'approved' && 'Your identity has been verified'}
            {status === 'rejected' && 'Please submit new documents'}
            {status === 'pending' && 'Your documents are being reviewed'}
          </p>
        </div>
      </div>
    </Card>
  );
};

const DocumentHistory = ({ documents }: { documents: KycDocument[] }) => {
  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-900 mb-6">Document History</h2>
      <div className="space-y-4">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
          >
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-medium text-slate-900">
                  {doc.document_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  doc.verification_status === 'approved'
                    ? 'bg-green-100 text-green-700'
                    : doc.verification_status === 'rejected'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {doc.verification_status.charAt(0).toUpperCase() + doc.verification_status.slice(1)}
                </span>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Document Number: {doc.document_number}
              </p>
              {doc.expiry_date && (
                <p className="text-sm text-slate-600">
                  Expires: {new Date(doc.expiry_date).toLocaleDateString()}
                </p>
              )}
              {doc.rejection_reason && (
                <p className="text-sm text-red-600 mt-1">
                  Reason: {doc.rejection_reason}
                </p>
              )}
            </div>
            <a
              href={doc.document_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-600 hover:text-purple-700"
            >
              View Document
            </a>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default function KycVerification() {
  const { user } = useStore();
  const queryClient = useQueryClient();

  const { data: documents, isLoading, error } = useQuery({
    queryKey: ['kyc-documents', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not found');

      const { data, error } = await supabase
        .from('kyc_documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  if (!user?.id) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-slate-600">Loading user data...</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-slate-600">Loading KYC status...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Failed to load KYC data</h2>
        <p className="text-slate-600 mb-4">Please try again later</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['kyc-documents'] })}>
          Retry
        </Button>
      </div>
    );
  }

  const latestDocument = documents?.[0];
  const status = latestDocument?.verification_status || 'not_submitted';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">KYC Verification</h1>
        <p className="text-slate-600">Complete your identity verification to activate your account</p>
      </div>

      <KycStatus status={status} />

      {(!documents || documents.length === 0 || status === 'rejected') && (
        <KycUploadForm onSuccess={() => queryClient.invalidateQueries({ queryKey: ['kyc-documents'] })} />
      )}

      {documents && documents.length > 0 && (
        <DocumentHistory documents={documents} />
      )}
    </div>
  );
};