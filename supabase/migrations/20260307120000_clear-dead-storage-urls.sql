-- Clear only storage URLs whose backing objects do not exist.
-- The old project (jqynxytwngtytvuzucuo) was deleted and many imported URLs were
-- rewritten to the new project ref without transferring the files. The original
-- version of this migration nulled every media URL, which also wiped valid uploads.
-- Restrict cleanup to URLs that point at missing storage objects.

-- Profiles: avatar and cover images
UPDATE profiles p
SET avatar = NULL
WHERE p.avatar LIKE '%/storage/v1/object/public/profile-images/%'
AND NOT EXISTS (
  SELECT 1
  FROM storage.objects o
  WHERE o.bucket_id = 'profile-images'
    AND o.name = substring(p.avatar FROM '/storage/v1/object/public/profile-images/(.*)$')
);

UPDATE profiles p
SET cover_image = NULL
WHERE p.cover_image LIKE '%/storage/v1/object/public/profile-images/%'
AND NOT EXISTS (
  SELECT 1
  FROM storage.objects o
  WHERE o.bucket_id = 'profile-images'
    AND o.name = substring(p.cover_image FROM '/storage/v1/object/public/profile-images/(.*)$')
);

-- Associations: logo and cover image
UPDATE associations a
SET logo = NULL
WHERE (
  a.logo LIKE '%/storage/v1/object/public/association-logos/%'
  AND NOT EXISTS (
    SELECT 1
    FROM storage.objects o
    WHERE o.bucket_id = 'association-logos'
      AND o.name = substring(a.logo FROM '/storage/v1/object/public/association-logos/(.*)$')
  )
)
OR (
  a.logo LIKE '%/storage/v1/object/public/profile-images/%'
  AND NOT EXISTS (
    SELECT 1
    FROM storage.objects o
    WHERE o.bucket_id = 'profile-images'
      AND o.name = substring(a.logo FROM '/storage/v1/object/public/profile-images/(.*)$')
  )
);

UPDATE associations a
SET cover_image = NULL
WHERE a.cover_image LIKE '%/storage/v1/object/public/profile-images/%'
AND NOT EXISTS (
  SELECT 1
  FROM storage.objects o
  WHERE o.bucket_id = 'profile-images'
    AND o.name = substring(a.cover_image FROM '/storage/v1/object/public/profile-images/(.*)$')
);

-- Companies: logo
UPDATE companies SET logo = NULL WHERE logo IS NOT NULL;

-- Posts: images, videos, documents
UPDATE posts SET image_url = NULL WHERE image_url IS NOT NULL;
UPDATE posts SET video_url = NULL WHERE video_url IS NOT NULL;
UPDATE posts SET document_url = NULL WHERE document_url IS NOT NULL;

-- Events: thumbnails and link preview images
UPDATE events SET thumbnail_url = NULL WHERE thumbnail_url IS NOT NULL;
UPDATE events SET link_preview_image = NULL WHERE link_preview_image IS NOT NULL;

-- Certifications: uploaded certificate files
UPDATE certifications SET certificate_file_url = NULL WHERE certificate_file_url IS NOT NULL;

-- Key functionaries: photo
UPDATE key_functionaries SET photo = NULL WHERE photo IS NOT NULL;

-- Messages: attachments JSON may contain storage URLs
-- Set to NULL where attachments contain the old/new supabase storage domain
UPDATE messages SET attachments = NULL
WHERE attachments IS NOT NULL
AND attachments::text LIKE '%supabase.co/storage%';
