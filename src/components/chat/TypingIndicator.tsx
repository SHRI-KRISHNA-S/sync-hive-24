 import { motion, AnimatePresence } from 'framer-motion';
 import { TypingUser } from '@/lib/supabase-types';
 
 interface TypingIndicatorProps {
   users: TypingUser[];
 }
 
 export const TypingIndicator = ({ users }: TypingIndicatorProps) => {
   if (users.length === 0) return null;
 
   const getTypingText = () => {
     if (users.length === 1) {
       return `${users[0].username} is typing`;
     } else if (users.length === 2) {
       return `${users[0].username} and ${users[1].username} are typing`;
     } else {
       return `${users[0].username} and ${users.length - 1} others are typing`;
     }
   };
 
   return (
     <AnimatePresence>
       <motion.div
         initial={{ opacity: 0, height: 0 }}
         animate={{ opacity: 1, height: 'auto' }}
         exit={{ opacity: 0, height: 0 }}
         className="px-4 py-1 text-sm text-muted-foreground flex items-center gap-2"
       >
         <div className="flex gap-1">
           <motion.span
             animate={{ y: [0, -4, 0] }}
             transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
             className="w-1.5 h-1.5 bg-primary rounded-full"
           />
           <motion.span
             animate={{ y: [0, -4, 0] }}
             transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
             className="w-1.5 h-1.5 bg-primary rounded-full"
           />
           <motion.span
             animate={{ y: [0, -4, 0] }}
             transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
             className="w-1.5 h-1.5 bg-primary rounded-full"
           />
         </div>
         <span>{getTypingText()}</span>
       </motion.div>
     </AnimatePresence>
   );
 };