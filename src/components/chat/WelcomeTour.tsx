import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, Hash, Users, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TOUR_STEPS = [
  {
    icon: Sparkles,
    title: 'Welcome to HiveSync! 🎉',
    description: "Your personal workspace has been set up automatically. Let's take a quick tour!",
  },
  {
    icon: Hash,
    title: 'Your Default Channel',
    description: 'This is your personal #general channel. Use it to jot down notes or test things out.',
  },
  {
    icon: Users,
    title: 'Teams & Channels',
    description: 'Create new teams to collaborate, or join existing ones with an invite code.',
  },
  {
    icon: MessageSquare,
    title: 'Direct Messages',
    description: 'Click on any team member to start a private conversation. You\'re all set!',
  },
];

const TOUR_SEEN_KEY = 'hivesync_tour_seen';

export const WelcomeTour = () => {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(TOUR_SEEN_KEY);
    if (!seen) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(TOUR_SEEN_KEY, 'true');
  };

  const next = () => {
    if (step < TOUR_STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      dismiss();
    }
  };

  if (!visible) return null;

  const current = TOUR_STEPS[step];
  const Icon = current.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        onClick={dismiss}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-card border border-border rounded-xl shadow-2xl max-w-sm w-full mx-4 p-6"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 -mr-2 -mt-1" onClick={dismiss}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <h3 className="text-lg font-semibold mb-2">{current.title}</h3>
          <p className="text-sm text-muted-foreground mb-6">{current.description}</p>

          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {TOUR_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'
                  }`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={dismiss}>
                Skip
              </Button>
              <Button size="sm" onClick={next}>
                {step < TOUR_STEPS.length - 1 ? 'Next' : 'Get Started'}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
