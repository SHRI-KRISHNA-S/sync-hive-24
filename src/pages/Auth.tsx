import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageSquare, Mail, Lock, User, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { z } from 'zod';
import { ForgotPasswordDialog } from '@/components/auth/ForgotPasswordDialog';
import { lovable } from '@/integrations/lovable/index';
import { Separator } from '@/components/ui/separator';
 
 const ALLOWED_DOMAIN = '@bitsathy.ac.in';

 const signInSchema = z.object({
   email: z.string().email('Please enter a valid email').refine(
     (email) => email.endsWith(ALLOWED_DOMAIN),
     { message: `Only ${ALLOWED_DOMAIN} email addresses are allowed` }
   ),
   password: z.string().min(6, 'Password must be at least 6 characters'),
 });
 
 const signUpSchema = signInSchema.extend({
    fullName: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name must be less than 50 characters'),
    username: z.string().min(3, 'Username must be at least 3 characters').max(20, 'Username must be less than 20 characters'),
  });
 
 export default function Auth() {
   const navigate = useNavigate();
   const { user, signIn, signUp, loading } = useAuth();
   const [isSignUp, setIsSignUp] = useState(false);
    const [formData, setFormData] = useState({
      email: '',
      password: '',
      username: '',
      fullName: '',
   });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
 
   useEffect(() => {
     if (user && !loading) {
       navigate('/');
     }
   }, [user, loading, navigate]);
 
   const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const { name, value } = e.target;
     setFormData(prev => ({ ...prev, [name]: value }));
     setErrors(prev => ({ ...prev, [name]: '' }));
   };
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     setErrors({});
 
     try {
       if (isSignUp) {
         signUpSchema.parse(formData);
       } else {
         signInSchema.parse(formData);
       }
     } catch (err) {
       if (err instanceof z.ZodError) {
         const newErrors: Record<string, string> = {};
         err.errors.forEach(error => {
           if (error.path[0]) {
             newErrors[error.path[0] as string] = error.message;
           }
         });
         setErrors(newErrors);
         return;
       }
     }
 
     setSubmitting(true);
 
     if (isSignUp) {
       const { error } = await signUp(formData.email, formData.password, formData.username, formData.fullName);
       if (error) {
         if (error.message.includes('already registered')) {
           toast.error('This email is already registered. Please sign in instead.');
         } else {
           toast.error(error.message);
         }
       } else {
         toast.success('Check your email to confirm your account!');
       }
     } else {
       const { error } = await signIn(formData.email, formData.password);
       if (error) {
         if (error.message.includes('Invalid login')) {
           toast.error('Invalid email or password');
         } else {
           toast.error(error.message);
         }
       }
     }
 
     setSubmitting(false);
   };
 
   if (loading) {
     return (
       <div className="min-h-screen flex items-center justify-center bg-background">
         <Loader2 className="w-8 h-8 animate-spin text-primary" />
       </div>
     );
   }
 
   return (
     <div className="min-h-screen flex bg-background">
       {/* Left Side - Branding */}
       <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/90 to-primary/70 p-12 flex-col justify-between">
         <div>
           <motion.div
             initial={{ opacity: 0, y: -20 }}
             animate={{ opacity: 1, y: 0 }}
             className="flex items-center gap-3"
           >
             <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
               <MessageSquare className="w-7 h-7 text-white" />
             </div>
             <span className="text-2xl font-bold text-white">TeamFlow</span>
           </motion.div>
         </div>
 
         <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.2 }}
           className="space-y-6"
         >
           <h1 className="text-4xl font-bold text-white leading-tight">
             Where teams come together<br />to do their best work.
           </h1>
           <p className="text-lg text-white/80">
             Real-time messaging, file sharing, and collaboration tools for modern teams.
           </p>
           <div className="flex gap-4">
             <div className="flex -space-x-2">
               {['🎨', '💻', '📊', '🚀'].map((emoji, i) => (
                 <div
                   key={i}
                   className="w-10 h-10 rounded-full bg-white/20 backdrop-blur border-2 border-white/30 flex items-center justify-center text-xl"
                 >
                   {emoji}
                 </div>
               ))}
             </div>
             <div className="text-white/80 text-sm">
               <span className="font-semibold text-white">1,000+</span> teams already connected
             </div>
           </div>
         </motion.div>
 
         <motion.p
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           transition={{ delay: 0.4 }}
           className="text-white/60 text-sm"
         >
           © 2024 TeamFlow. Built with ❤️ for teams everywhere.
         </motion.p>
       </div>
 
       {/* Right Side - Form */}
       <div className="flex-1 flex items-center justify-center p-8">
         <motion.div
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           transition={{ duration: 0.3 }}
           className="w-full max-w-md"
         >
           <Card className="border-0 shadow-2xl shadow-primary/5">
             <CardHeader className="space-y-1 pb-6">
               <div className="lg:hidden flex items-center gap-2 mb-4">
                 <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                   <MessageSquare className="w-6 h-6 text-primary-foreground" />
                 </div>
                 <span className="text-xl font-bold">TeamFlow</span>
               </div>
               <CardTitle className="text-2xl font-bold">
                 {isSignUp ? 'Create your account' : 'Welcome back'}
               </CardTitle>
               <CardDescription>
                 {isSignUp
                   ? 'Get started with TeamFlow in seconds'
                   : 'Sign in to continue to TeamFlow'}
               </CardDescription>
             </CardHeader>
 
             <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                     onClick={async () => {
                       const { error } = await lovable.auth.signInWithOAuth("google", {
                         redirect_uri: window.location.origin,
                         extraParams: {
                           hd: "bitsathy.ac.in",
                         },
                       });
                       if (error) {
                         toast.error('Please try with your @bitsathy.ac.in email');
                       }
                    }}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continue with Google
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <Separator className="w-full" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">or</span>
                    </div>
                  </div>

                   {isSignUp && (
                     <>
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="fullName"
                            name="fullName"
                            type="text"
                            placeholder="John Doe"
                            value={formData.fullName}
                            onChange={handleChange}
                            className={`pl-10 ${errors.fullName ? 'border-destructive' : ''}`}
                          />
                        </div>
                        {errors.fullName && (
                          <p className="text-xs text-destructive">{errors.fullName}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="username"
                            name="username"
                            type="text"
                            placeholder="johndoe"
                            value={formData.username}
                            onChange={handleChange}
                            className={`pl-10 ${errors.username ? 'border-destructive' : ''}`}
                          />
                        </div>
                        {errors.username && (
                          <p className="text-xs text-destructive">{errors.username}</p>
                        )}
                      </div>
                    </>
                  )}
 
                 <div className="space-y-2">
                   <Label htmlFor="email">Email</Label>
                   <div className="relative">
                     <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                     <Input
                       id="email"
                       name="email"
                       type="email"
                       placeholder="name@bitsathy.ac.in"
                       value={formData.email}
                       onChange={handleChange}
                       className={`pl-10 ${errors.email ? 'border-destructive' : ''}`}
                     />
                   </div>
                   {errors.email && (
                     <p className="text-xs text-destructive">{errors.email}</p>
                   )}
                 </div>
 
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleChange}
                      className={`pl-10 pr-10 ${errors.password ? 'border-destructive' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-destructive">{errors.password}</p>
                  )}
                </div>
               </CardContent>
 
                <CardFooter className="flex flex-col gap-4">
                  {!isSignUp && (
                    <div className="w-full flex justify-end -mt-2 -mb-1">
                      <ForgotPasswordDialog />
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={submitting}>
                   {submitting ? (
                     <Loader2 className="w-4 h-4 animate-spin" />
                   ) : (
                     <>
                       {isSignUp ? 'Create Account' : 'Sign In'}
                       <ArrowRight className="w-4 h-4 ml-2" />
                     </>
                   )}
                 </Button>
 
                 <p className="text-sm text-muted-foreground text-center">
                   {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                   <button
                     type="button"
                     onClick={() => {
                       setIsSignUp(!isSignUp);
                       setErrors({});
                     }}
                     className="text-primary font-medium hover:underline"
                   >
                     {isSignUp ? 'Sign in' : 'Sign up'}
                   </button>
                 </p>
               </CardFooter>
             </form>
           </Card>
         </motion.div>
       </div>
     </div>
   );
 }