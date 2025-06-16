import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-hot-toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import TextareaField from '../../components/ui/TextareaField';
import SelectField from '../../components/ui/SelectField';
import { User, DollarSign, Globe, Languages, BookOpen, Image as ImageIcon, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../lib/store';

const allCategories = [
  'Psychic Readings',
  'Tarot',
  'Astrology',
  'Numerology',
  'Dream Analysis',
  'Spiritual Healing',
  'Love & Relationships',
  'Career & Finance',
  'Past Lives',
  'Energy Healing',
  'Crystal Reading',
  'Aura Reading',
  'Chakra Balancing',
  'Mediumship',
  'Angel Reading'
];

const allLanguages = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Russian',
  'Chinese',
  'Japanese',
  'Korean',
  'Arabic',
  'Hindi'
];

const allSpecialties = [
  'Love & Relationships',
  'Career & Finance',
  'Life Path & Purpose',
  'Past Lives',
  'Spirit Guides',
  'Dream Analysis',
  'Energy Healing',
  'Chakra Balancing',
  'Astrology',
  'Numerology',
  'Tarot Reading',
  'Crystal Reading'
];

const payoutMethods = [
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'stripe', label: 'Stripe' }
];

export default function ProfileSettings() {
  const { user, fetchUser } = useStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [profile, setProfile] = useState({
    bio: '',
    categories: [] as string[],
    languages: [] as string[],
    specialties: [] as string[],
    price_per_minute: 1.99,
    is_available: false,
    payout_method: '',
    payout_details: {},
    profile_picture: null as string | null,
    video_enabled: false,
    voice_enabled: false
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      setProfilePicture(file);
      setProfilePictureUrl(URL.createObjectURL(file));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif']
    },
    maxFiles: 1,
    multiple: false
  });

  useEffect(() => {
    loadProfile();
  }, [user?.id]);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      if (!user?.id) return;

      const { data: profileData, error } = await supabase
        .from('advisor_profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (profileData && profileData.length > 0) {
        const latestProfile = profileData[0];
        setProfile({
          bio: latestProfile.bio || '',
          categories: latestProfile.categories || [],
          languages: latestProfile.languages || [],
          specialties: latestProfile.specialties || [],
          price_per_minute: latestProfile.price_per_minute || 1.99,
          is_available: latestProfile.is_available || false,
          payout_method: latestProfile.payout_method || '',
          payout_details: latestProfile.payout_details || {},
          profile_picture: latestProfile.profile_picture,
          video_enabled: latestProfile.video_enabled || false,
          voice_enabled: latestProfile.voice_enabled || false
        });
        setProfilePictureUrl(latestProfile.profile_picture);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const uploadProfilePicture = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${user?.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('profile-pic')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('profile-pic')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    try {
      setIsSaving(true);

      let profilePictureUrl = profile.profile_picture;

      // Upload new profile picture if selected
      if (profilePicture) {
        profilePictureUrl = await uploadProfilePicture(profilePicture);
      }

      // Validate required fields
      if (profile.languages.length === 0) {
        toast.error('Please select at least one language');
        return;
      }

      if (profile.categories.length > 5) {
        toast.error('Please select up to 5 categories');
        return;
      }

      if (profile.specialties.length > 5) {
        toast.error('Please select up to 5 specialties');
        return;
      }

      const { error } = await supabase
        .from('advisor_profiles')
        .upsert({
          user_id: user.id,
          bio: profile.bio,
          categories: profile.categories,
          languages: profile.languages,
          specialties: profile.specialties,
          price_per_minute: profile.price_per_minute,
          is_available: profile.is_available,
          payout_method: profile.payout_method,
          payout_details: profile.payout_details,
          profile_picture: profilePictureUrl,
          video_enabled: profile.video_enabled,
          voice_enabled: profile.voice_enabled,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast.success('Profile updated successfully');
      await loadProfile();
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-slate-600">Loading profile...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Profile Settings</h1>
        <p className="text-slate-600">Manage your advisor profile and preferences</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Basic Information</h2>
          <div className="space-y-6">
            <div className="flex items-start space-x-6">
              <div className="flex-shrink-0">
                <div
                  {...getRootProps()}
                  className={`w-32 h-32 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors ${
                    isDragActive
                      ? 'border-purple-400 bg-purple-50'
                      : 'border-slate-300 hover:border-purple-400 hover:bg-purple-50'
                  }`}
                >
                  <input {...getInputProps()} />
                  {profilePictureUrl ? (
                    <img
                      src={profilePictureUrl}
                      alt="Profile"
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <div className="text-center">
                      <ImageIcon className="mx-auto h-8 w-8 text-slate-400" />
                      <span className="mt-2 block text-xs text-slate-500">
                        {isDragActive ? 'Drop here' : 'Upload photo'}
                      </span>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-500 text-center">
                  JPG, PNG or GIF<br />Max 5MB
                </p>
              </div>

              <div className="flex-1 space-y-4">
                <FormField
                  label="Price per Minute ($)"
                  type="number"
                  step="0.01"
                  min="0.99"
                  value={profile.price_per_minute}
                  onChange={(e) => setProfile({ ...profile, price_per_minute: parseFloat(e.target.value) })}
                  required
                  icon={<DollarSign className="w-5 h-5" />}
                />

                <SelectField
                  label="Payout Method"
                  value={profile.payout_method}
                  onChange={(e) => setProfile({ ...profile, payout_method: e.target.value })}
                  options={payoutMethods}
                  required
                />
              </div>
            </div>
          </div>
        </Card>

        {/* About Me */}
        <Card>
          <h2 className="text-lg font-semibold text-slate-900 mb-6">About Me</h2>
          <TextareaField
            label="Bio"
            value={profile.bio}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            required
            rows={4}
            maxLength={500}
            placeholder="Tell clients about your experience and specialties..."
            hint="Maximum 500 characters"
          />
        </Card>

        {/* Expertise */}
        <Card>
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Expertise</h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Categories
                <span className="text-red-500 ml-1">*</span>
                <span className="text-sm text-slate-500 ml-2">(Select up to 5)</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {allCategories.map((category) => (
                  <label key={category} className="flex items-center">
                    <input
                      type="checkbox"
                      className="rounded text-purple-600"
                      checked={profile.categories.includes(category)}
                      onChange={(e) => {
                        const newCategories = e.target.checked
                          ? [...profile.categories, category]
                          : profile.categories.filter(c => c !== category);
                        if (e.target.checked && newCategories.length > 5) {
                          toast.error('Maximum 5 categories allowed');
                          return;
                        }
                        setProfile({ ...profile, categories: newCategories });
                      }}
                    />
                    <span className="ml-2 text-sm text-slate-600">{category}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Languages
                <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {allLanguages.map((language) => (
                  <label key={language} className="flex items-center">
                    <input
                      type="checkbox"
                      className="rounded text-purple-600"
                      checked={profile.languages.includes(language)}
                      onChange={(e) => {
                        const newLanguages = e.target.checked
                          ? [...profile.languages, language]
                          : profile.languages.filter(l => l !== language);
                        setProfile({ ...profile, languages: newLanguages });
                      }}
                    />
                    <span className="ml-2 text-sm text-slate-600">{language}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Specialties
                <span className="text-red-500 ml-1">*</span>
                <span className="text-sm text-slate-500 ml-2">(Select up to 5)</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {allSpecialties.map((specialty) => (
                  <label key={specialty} className="flex items-center">
                    <input
                      type="checkbox"
                      className="rounded text-purple-600"
                      checked={profile.specialties.includes(specialty)}
                      onChange={(e) => {
                        const newSpecialties = e.target.checked
                          ? [...profile.specialties, specialty]
                          : profile.specialties.filter(s => s !== specialty);
                        if (e.target.checked && newSpecialties.length > 5) {
                          toast.error('Maximum 5 specialties allowed');
                          return;
                        }
                        setProfile({ ...profile, specialties: newSpecialties });
                      }}
                    />
                    <span className="ml-2 text-sm text-slate-600">{specialty}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Communication Preferences */}
        <Card>
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Communication Preferences</h2>
          <div className="space-y-4">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                className="rounded text-purple-600"
                checked={profile.video_enabled}
                onChange={(e) => setProfile({ ...profile, video_enabled: e.target.checked })}
              />
              <span className="text-slate-700">Enable video calls</span>
            </label>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                className="rounded text-purple-600"
                checked={profile.voice_enabled}
                onChange={(e) => setProfile({ ...profile, voice_enabled: e.target.checked })}
              />
              <span className="text-slate-700">Enable voice calls</span>
            </label>
          </div>
        </Card>

        {/* Availability Status */}
        <Card>
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Availability Status</h2>
          <div className="space-y-4">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                className="rounded text-purple-600"
                checked={profile.is_available}
                onChange={(e) => setProfile({ ...profile, is_available: e.target.checked })}
              />
              <span className="text-slate-700">Show as available for new sessions</span>
            </label>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}