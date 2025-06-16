/*
  # Create storage bucket for profile pictures

  1. New Storage Bucket
    - Creates a 'profile-pic' bucket for storing advisor profile pictures
    - Sets up public access policies for viewing profile pictures
    - Restricts upload/delete operations to authenticated users for their own files

  2. Security
    - Enables public read access for all profile pictures
    - Allows authenticated users to upload their own profile pictures
    - Allows authenticated users to update/delete their own profile pictures
*/

-- Create the storage bucket
insert into storage.buckets (id, name, public)
values ('profile-pic', 'profile-pic', true);

-- Allow public access to view profile pictures
create policy "Public Access"
on storage.objects for select
to public
using ( bucket_id = 'profile-pic' );

-- Allow authenticated users to upload their own profile pictures
create policy "Users can upload their own profile pictures"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-pic' 
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own profile pictures
create policy "Users can update their own profile pictures"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-pic'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-pic'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own profile pictures
create policy "Users can delete their own profile pictures"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-pic'
  and (storage.foldername(name))[1] = auth.uid()::text
);