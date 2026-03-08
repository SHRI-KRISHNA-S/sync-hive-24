import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmilePlus } from 'lucide-react';
import { ReactionGroup } from '@/hooks/useReactions';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏', '🙏', '💯', '👀', '🚀'];

interface MessageReactionsProps {
  reactions: ReactionGroup[];
  onToggle: (emoji: string) => void;
  compact?: boolean;
}

export const MessageReactions = ({ reactions, onToggle, compact }: MessageReactionsProps) => {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1">
      <AnimatePresence>
        {reactions.map((r) => (
          <motion.button
            key={r.emoji}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => onToggle(r.emoji)}
            className={`
              inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs
              border transition-colors cursor-pointer
              ${r.hasReacted
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-muted/50 border-border hover:bg-muted text-muted-foreground'
              }
            `}
          >
            <span className="text-sm">{r.emoji}</span>
            <span className="font-medium">{r.count}</span>
          </motion.button>
        ))}
      </AnimatePresence>

      <Popover open={showPicker} onOpenChange={setShowPicker}>
        <PopoverTrigger asChild>
          <button
            className="inline-flex items-center justify-center h-6 w-6 rounded-full 
              opacity-0 group-hover:opacity-60 hover:!opacity-100
              hover:bg-muted transition-all text-muted-foreground"
          >
            <SmilePlus className="w-3.5 h-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" side="top" align="start">
          <div className="grid grid-cols-6 gap-1">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onToggle(emoji);
                  setShowPicker(false);
                }}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-muted transition-colors text-lg"
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
