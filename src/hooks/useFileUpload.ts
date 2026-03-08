import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface UploadedFile {
  file_url: string;
  file_name: string;
  file_type: string | null;
  file_size: number;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_FILE_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const useFileUpload = () => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);

  const uploadFile = async (file: File): Promise<UploadedFile | null> => {
    if (!user) return null;

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large (max 10MB)');
      return null;
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error('File type not supported');
      return null;
    }

    setUploading(true);

    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error } = await supabase.storage
      .from('attachments')
      .upload(filePath, file);

    setUploading(false);

    if (error) {
      toast.error('Upload failed');
      console.error('Upload error:', error);
      return null;
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('attachments')
      .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7-day expiry

    if (signedUrlError || !signedUrlData?.signedUrl) {
      toast.error('Failed to generate file URL');
      console.error('Signed URL error:', signedUrlError);
      return null;
    }

    const uploaded: UploadedFile = {
      file_url: signedUrlData.signedUrl,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
    };

    return uploaded;
  };

  const addPendingFile = async (file: File) => {
    const uploaded = await uploadFile(file);
    if (uploaded) {
      setPendingFiles(prev => [...prev, uploaded]);
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearPendingFiles = () => {
    setPendingFiles([]);
  };

  const isImage = (fileType: string | null) => {
    return fileType ? ALLOWED_IMAGE_TYPES.includes(fileType) : false;
  };

  return {
    uploading,
    pendingFiles,
    addPendingFile,
    removePendingFile,
    clearPendingFiles,
    isImage,
  };
};
