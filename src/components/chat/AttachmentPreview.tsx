import { X, FileText, Image as ImageIcon } from 'lucide-react';
import { UploadedFile } from '@/hooks/useFileUpload';
import { Button } from '@/components/ui/button';

interface AttachmentPreviewProps {
  files: UploadedFile[];
  onRemove: (index: number) => void;
  isImage: (type: string | null) => boolean;
}

export const AttachmentPreview = ({ files, onRemove, isImage }: AttachmentPreviewProps) => {
  if (files.length === 0) return null;

  return (
    <div className="flex gap-2 flex-wrap px-2 pt-2">
      {files.map((file, index) => (
        <div
          key={index}
          className="relative group rounded-lg border border-border bg-muted/50 overflow-hidden"
        >
          {isImage(file.file_type) ? (
            <img
              src={file.file_url}
              alt={file.file_name}
              className="h-20 w-20 object-cover"
            />
          ) : (
            <div className="h-20 w-20 flex flex-col items-center justify-center p-2">
              <FileText className="w-6 h-6 text-muted-foreground mb-1" />
              <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                {file.file_name}
              </span>
            </div>
          )}
          <Button
            variant="destructive"
            size="icon"
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onRemove(index)}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      ))}
    </div>
  );
};

// Display attachments inline in messages
interface MessageAttachmentsProps {
  attachments: { file_url: string; file_name: string; file_type: string | null; file_size: number | null }[];
}

export const MessageAttachments = ({ attachments }: MessageAttachmentsProps) => {
  if (!attachments || attachments.length === 0) return null;

  const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {attachments.map((att, i) => {
        if (imageTypes.includes(att.file_type || '')) {
          return (
            <a key={i} href={att.file_url} target="_blank" rel="noopener noreferrer">
              <img
                src={att.file_url}
                alt={att.file_name}
                className="max-w-xs max-h-60 rounded-lg border border-border object-cover hover:opacity-90 transition-opacity"
              />
            </a>
          );
        }
        return (
          <a
            key={i}
            href={att.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 border border-border transition-colors"
          >
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground truncate max-w-[200px]">{att.file_name}</span>
            {att.file_size && (
              <span className="text-xs text-muted-foreground">
                {(att.file_size / 1024).toFixed(0)}KB
              </span>
            )}
          </a>
        );
      })}
    </div>
  );
};
