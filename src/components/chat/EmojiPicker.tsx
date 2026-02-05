 import { useState } from 'react';
 import { Input } from '@/components/ui/input';
 import { ScrollArea } from '@/components/ui/scroll-area';
 
 interface EmojiPickerProps {
   onSelect: (emoji: string) => void;
 }
 
 const EMOJI_CATEGORIES = {
   'Smileys': ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😍', '🥰', '😘', '😗', '😋', '😛', '🤪', '😜', '🤓', '😎', '🤩', '🥳', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥸', '😈', '👿', '👹', '👺', '💀', '☠️', '👻', '👽', '👾', '🤖'],
   'Gestures': ['👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐', '🖖', '👋', '🤙', '💪', '🦾', '🙏', '✍️', '🤳', '💅'],
   'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'],
   'Objects': ['💼', '📁', '📂', '🗂️', '📅', '📆', '📇', '📈', '📉', '📊', '📋', '📌', '📍', '📎', '🖇️', '📏', '📐', '✂️', '🗃️', '🗄️', '🗑️', '🔒', '🔓', '🔑', '🗝️', '🔨', '🪓', '⛏️', '⚒️', '🛠️', '🗡️', '⚔️', '🔫', '🏹', '🛡️', '🔧', '🔩', '⚙️', '🗜️', '⚖️', '🦯', '🔗', '⛓️', '🧰', '🧲'],
   'Nature': ['🌸', '🌷', '🌹', '🥀', '🌺', '🌻', '🌼', '🌱', '🌲', '🌳', '🌴', '🌵', '🌾', '🌿', '☘️', '🍀', '🍁', '🍂', '🍃', '🌍', '🌎', '🌏', '🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘', '🌙', '🌚', '🌛', '🌜', '☀️', '🌝', '🌞', '⭐', '🌟', '🌠', '☁️', '⛅', '⛈️', '🌤️', '🌥️', '🌦️', '🌧️', '🌨️', '🌩️', '🌪️', '🌫️', '🌬️', '🌀', '🌈', '⚡', '❄️', '☃️', '⛄', '☄️', '🔥', '💧', '🌊'],
   'Food': ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕'],
 };
 
 export const EmojiPicker = ({ onSelect }: EmojiPickerProps) => {
   const [search, setSearch] = useState('');
 
   const allEmojis = Object.values(EMOJI_CATEGORIES).flat();
   const filteredEmojis = search 
     ? allEmojis.filter(() => true) // In a real app, we'd filter by name
     : null;
 
   return (
     <div className="space-y-2">
       <Input
         placeholder="Search emoji..."
         value={search}
         onChange={(e) => setSearch(e.target.value)}
         className="h-8"
       />
       <ScrollArea className="h-48">
         {filteredEmojis ? (
           <div className="grid grid-cols-8 gap-1">
             {filteredEmojis.map((emoji, i) => (
               <button
                 key={i}
                 onClick={() => onSelect(emoji)}
                 className="text-xl p-1 hover:bg-muted rounded transition-colors"
               >
                 {emoji}
               </button>
             ))}
           </div>
         ) : (
           Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
             <div key={category} className="mb-3">
               <h4 className="text-xs font-medium text-muted-foreground mb-1">{category}</h4>
               <div className="grid grid-cols-8 gap-1">
                 {emojis.slice(0, 16).map((emoji, i) => (
                   <button
                     key={i}
                     onClick={() => onSelect(emoji)}
                     className="text-xl p-1 hover:bg-muted rounded transition-colors"
                   >
                     {emoji}
                   </button>
                 ))}
               </div>
             </div>
           ))
         )}
       </ScrollArea>
     </div>
   );
 };