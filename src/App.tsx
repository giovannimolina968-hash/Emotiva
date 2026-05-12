import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  ChevronLeft,
  Plus,
  Send,
  Calendar,
  Smile,
  BookOpen,
  User,
  Heart,
  Frown,
  Meh,
  Annoyed,
  Laugh,
  PartyPopper,
  Lightbulb,
  Quote,
  Search,
  Brain,
  Zap,
  Coffee,
  Sun,
  Moon,
  MessageCircle,
  Settings,
  Lock,
  Unlock,
  X,
  LogOut,
  Shield,
  Eye,
  EyeOff,
  Trophy,
  Award,
  Crown,
  Fingerprint,
  Download,
  BatteryLow,
  MoreVertical,
  Trash2,
  Edit3,
  RefreshCcw,
  RotateCcw,
  Activity,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Wind
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import confetti from 'canvas-confetti';
import { auth, db } from './lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  setDoc,
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

// Inicializar Gemini
const GEMINI_KEY = typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '';
const genAI = new GoogleGenerativeAI(GEMINI_KEY || '');

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 segundo

async function callGeminiWithRetry(fn: () => Promise<any>, retries = MAX_RETRIES, delay = INITIAL_RETRY_DELAY): Promise<any> {
  try {
    return await fn();
  } catch (error: any) {
    const isRateLimit = error?.message?.includes('429') || 
                      error?.message?.includes('RESOURCE_EXHAUSTED') ||
                      error?.message?.includes('high demand');
    
    if (isRateLimit && retries > 0) {
      console.log(`Gemini bajo mucha demanda, reintentando en ${delay}ms... (Intentos restantes: ${retries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callGeminiWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

interface JournalEntry {
  id: string;
  date: string;
  content: string;
  mood: string;
  tip?: string;
  timestamp: Date;
  colorClass: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
}

const MOOD_COLORS: Record<string, string> = {
  'Motivado': 'bg-orange-100 border-orange-200 text-orange-800',
  'Tranca': 'bg-blue-100 border-blue-200 text-blue-800',
  'Chévere': 'bg-green-100 border-green-200 text-green-800',
  'Triste': 'bg-indigo-100 border-indigo-200 text-indigo-800',
  'Enojado': 'bg-red-100 border-red-200 text-red-800',
  'Reflexivo': 'bg-purple-100 border-purple-200 text-purple-800',
  'Relajado': 'bg-teal-100 border-teal-200 text-teal-800',
  'Cansado': 'bg-gray-100 border-gray-200 text-gray-800',
  'Sereno': 'bg-sky-50 border-sky-100 text-sky-700',
  'Melancólico': 'bg-indigo-50 border-indigo-100 text-indigo-700',
  'Empoderado': 'bg-amber-50 border-amber-100 text-amber-700',
  'Agotado': 'bg-slate-100 border-slate-200 text-slate-600',
  'Ilusionado': 'bg-pink-50 border-pink-100 text-pink-700',
  'Vulnerable': 'bg-rose-50 border-rose-100 text-rose-700',
  'Radiante': 'bg-yellow-50 border-yellow-100 text-yellow-700',
  'Resiliente': 'bg-emerald-50 border-emerald-100 text-emerald-700',
};

const MOOD_ICONS: Record<string, any> = {
  'Motivado': Laugh,
  'Tranca': Meh,
  'Chévere': PartyPopper,
  'Triste': Frown,
  'Enojado': Annoyed,
  'Reflexivo': Brain,
  'Relajado': Smile,
  'Cansado': Coffee,
  'Sereno': Wind,
  'Melancólico': Moon,
  'Empoderado': Zap,
  'Agotado': BatteryLow,
  'Ilusionado': Sparkles,
  'Vulnerable': Heart,
  'Radiante': Sun,
  'Resiliente': Shield,
};

const WRITING_PROMPTS = [
  "Hoy pasó algo que...",
  "Me sentí de repente...",
  "No puedo dejar de pensar en...",
  "Si este día fuera una canción, sería...",
  "Le diría a mi yo de la mañana que...",
  "Descubrí que soy capaz de...",
  "Lo que más me dolió fue...",
  "Lo que me hizo brillar hoy...",
  "Siento un nudo en...",
  "La paz hoy se sintió como...",
  "Un pequeño detalle que cambió todo...",
  "Me gustaría perdonarme por...",
  "Si mis sentimientos tuvieran color...",
  "Lo que nunca dije hoy...",
  "Estoy agradecido por...",
];

const DEFAULT_COLOR = 'bg-pink-50 border-pink-100 text-pink-800';

const Logo = ({ size = "md", className = "" }: { size?: "sm" | "md" | "lg" | "xl", className?: string }) => {
  const sizes = {
    sm: "w-12 h-12",
    md: "w-20 h-20",
    lg: "w-24 h-24",
    xl: "w-32 h-32"
  };
  const heartSizes = {
    sm: "w-6 h-6",
    md: "w-10 h-10",
    lg: "w-12 h-12",
    xl: "w-16 h-16"
  };
  const starSizes = {
    sm: "w-4 h-4 -top-1 -right-1",
    md: "w-8 h-8 -top-2 -right-2",
    lg: "w-8 h-8 -top-2 -right-2",
    xl: "w-12 h-12 -top-3 -right-3"
  };

  return (
    <div className={`relative ${sizes[size]} ${className}`}>
      {/* Glow Effect */}
      <div className="absolute inset-0 bg-pink-400/20 blur-2xl rounded-full"></div>
      
      {/* Background Squircle with Gradient */}
      <div className="absolute inset-0 bg-gradient-to-tr from-[#FF3B9E] via-[#BB9BFF] to-[#805BFF] rounded-[30%] shadow-[0_15px_35px_rgba(236,72,153,0.3)] flex items-center justify-center transform active:scale-95 transition-transform overflow-visible">
        <Heart className={`${heartSizes[size]} text-white fill-white`} />
        
        {/* The Sparkle/Star in the top right */}
        <div className={`absolute ${starSizes[size]} text-[#FFE168] pointer-events-none drop-shadow-md`}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z" fill="currentColor" />
            <circle cx="4" cy="18" r="1.5" fill="currentColor" />
          </svg>
        </div>
      </div>
    </div>
  );
};

const CompanionMascot = ({ isTyping, size = "normal" }: { isTyping: boolean, size?: "small" | "normal" }) => {
  const sizeClasses = size === "small" 
    ? "w-14 h-14 md:w-16 md:h-16" 
    : "w-32 h-32 md:w-40 md:h-40";
  
  return (
    <motion.div 
      animate={{ 
        y: size === "small" ? [0, -5, 0] : [0, -20, 0],
        scale: isTyping ? [1, 1.05, 1] : [1, 1.02, 1]
      }}
      transition={{ 
        y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
        scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
      }}
      className={`relative ${sizeClasses} flex items-center justify-center`}
    >
      {/* Super Aura */}
      <div className={`absolute inset-0 bg-pink-300/40 shadow-[0_0_${size === "small" ? '20px' : '100px'}_rgba(244,114,182,0.3)] blur-${size === "small" ? 'lg' : '3xl'} rounded-full animate-pulse`} />
      
      {/* Floppy Cuter Ears */}
      <motion.div 
        animate={{ rotate: isTyping ? [-15, -20, -15] : -12 }}
        className={`absolute ${size === "small" ? '-top-1 left-1.5 w-4 h-5' : '-top-4 left-4 w-10 h-12'} bg-gradient-to-b from-pink-300 to-pink-400 rounded-full border-${size === "small" ? '2' : '4'} border-white shadow-sm z-0`} 
      />
      <motion.div 
        animate={{ rotate: isTyping ? [15, 20, 15] : 12 }}
        className={`absolute ${size === "small" ? '-top-1 right-1.5 w-4 h-5' : '-top-4 right-4 w-10 h-12'} bg-gradient-to-b from-pink-300 to-pink-400 rounded-full border-${size === "small" ? '2' : '4'} border-white shadow-sm z-0`} 
      />
      
      <div className={`relative w-full h-full bg-gradient-to-br from-pink-300 via-rose-300 to-indigo-300 rounded-[45%] shadow-[0_${size === "small" ? '5px_10px' : '20px_50px'}_rgba(244,114,182,0.3)] flex flex-col items-center justify-center border-${size === "small" ? '2' : '4'} border-white overflow-hidden z-10 transition-all`}>
        {/* Soft Shimmer Overlay */}
        <motion.div 
          animate={{ x: [-200, 400] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12" 
        />
        
        <div className="relative z-20 flex flex-col items-center">
          {/* Eyes */}
          <div className={`flex ${size === "small" ? 'gap-2.5 mb-0.5' : 'gap-8 mb-4'}`}>
            <motion.div 
              animate={{ 
                scaleY: [1, 0.1, 1],
                scale: isTyping ? [1, 1.1, 1] : 1
              }} 
              transition={{ scaleY: { repeat: Infinity, duration: 4, times: [0, 0.05, 0.1] } }}
              className={`${size === "small" ? 'w-1.5 h-2' : 'w-5 h-6'} bg-slate-900 rounded-full relative`}
            >
               <div className={`absolute top-0.5 left-0.5 ${size === "small" ? 'w-0.5 h-0.5' : 'w-2 h-2'} bg-white rounded-full`} />
            </motion.div>
            <motion.div 
              animate={{ 
                scaleY: [1, 0.1, 1],
                scale: isTyping ? [1, 1.1, 1] : 1
              }} 
              transition={{ scaleY: { repeat: Infinity, duration: 4, times: [0, 0.05, 0.1] } }}
              className={`${size === "small" ? 'w-1.5 h-2' : 'w-5 h-6'} bg-slate-900 rounded-full relative`}
            >
               <div className={`absolute top-0.5 left-0.5 ${size === "small" ? 'w-0.5 h-0.5' : 'w-2 h-2'} bg-white rounded-full`} />
            </motion.div>
          </div>
          
          {/* Blush */}
          <div className={`flex ${size === "small" ? 'gap-4 absolute top-2.5' : 'gap-12 absolute top-8'}`}>
            <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 2, repeat: Infinity }} className={`${size === "small" ? 'w-1.5 h-0.5' : 'w-5 h-2.5'} bg-rose-200 rounded-full blur-[1px]`} />
            <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 2, repeat: Infinity }} className={`${size === "small" ? 'w-1.5 h-0.5' : 'w-5 h-2.5'} bg-rose-200 rounded-full blur-[1px]`} />
          </div>

          {/* Cuter Tiny Smile */}
          <motion.div 
             animate={isTyping ? { y: [0, 1, 0], scaleX: [1, 1.2, 1] } : {}}
             className={`${size === "small" ? 'w-3 h-1.5 border-b-[1.5px]' : 'w-10 h-5 border-b-4'} border-white/80 rounded-full mt-0.5`} 
          />
        </div>
      </div>

      {/* Outer Floating Icons */}
      <motion.div 
        animate={{ y: [0, -3, 0], rotate: [0, 10, -10, 0] }}
        transition={{ duration: 4, repeat: Infinity }}
        className="absolute -top-2 -left-2 text-pink-300"
      >
        <Heart className={`${size === "small" ? 'w-3 h-3' : 'w-8 h-8'} fill-pink-300`} />
      </motion.div>
      <motion.div 
        animate={{ scale: [1, 1.2, 1], rotate: [0, 20, -20, 0] }}
        transition={{ duration: 5, repeat: Infinity }}
        className="absolute -bottom-1 -right-1 text-yellow-300"
      >
        <Sparkles className={`${size === "small" ? 'w-3 h-3' : 'w-8 h-8'}`} />
      </motion.div>
    </motion.div>
  );
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [view, setView] = useState<'timeline' | 'writing' | 'chat'>('timeline');
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [securityEnabled, setSecurityEnabled] = useState(false);
  const [pin, setPin] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [autoPlayAudio, setAutoPlayAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speakText = (text: string, msgId: string) => {
    if (isPlaying === msgId) {
      window.speechSynthesis.cancel();
      setIsPlaying(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Configuramos una voz que suene tranquila y femenina si está disponible
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => (v.name.includes('Google') || v.name.includes('Natural')) && v.lang.startsWith('es')) || voices.find(v => v.lang.startsWith('es'));
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.pitch = 1.2; // Un tono más tierno, dulce e íntimo
    utterance.rate = 0.85; // Un poco más lento para transmitir paz, cercanía y mucha confianza
    
    utterance.onend = () => setIsPlaying(null);
    utterance.onerror = () => setIsPlaying(null);
    
    setIsPlaying(msgId);
    window.speechSynthesis.speak(utterance);
  };
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [biometryAvailable, setBiometryAvailable] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // Standalone detection and install prompt logic
  useEffect(() => {
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(isStandaloneMode);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && securityEnabled && pin) {
        setIsLocked(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [securityEnabled, pin]);

  // PIN Config Flow
  const [isConfiguringPin, setIsConfiguringPin] = useState(false);
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [configStep, setConfigStep] = useState<'create' | 'confirm'>('create');
  const [configError, setConfigError] = useState('');

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isAppReady, setIsAppReady] = useState(false);
  const [globalMood, setGlobalMood] = useState('Relajado');
  const [moodInsight, setMoodInsight] = useState('Todo fluye a tu ritmo...');
  const [isAnalyzingGlobal, setIsAnalyzingGlobal] = useState(false);

  // States for Edit/Delete
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [weeklyWisdom, setWeeklyWisdom] = useState<string | null>(null);
  const [isGeneratingWisdom, setIsGeneratingWisdom] = useState(false);
  const [showWisdomModal, setShowWisdomModal] = useState(false);

  const [showSOS, setShowSOS] = useState(false);
  const [sosStep, setSosStep] = useState(0);

  const [aiPromptSuggested, setAiPromptSuggested] = useState('');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  const generateAIPrompt = async () => {
    if (isGeneratingPrompt) return;
    setIsGeneratingPrompt(true);
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(`Actúa como un mentor de mindfulness. Genera una pregunta corta (máx 60 caracteres) para invitar a alguien a escribir en su diario. 
        Usa un tono suave, curioso y reflexivo. 
        Contexto (estado actual): "${globalMood}".
        Idiomas: Español Latino. 
        Ejemplo: "¿Qué te hizo sonreír hoy sin querer?" o "¿Qué peso quieres soltar hoy?".`);
      const response = await result.response;
      setAiPromptSuggested(response.text()?.trim() || '');
    } catch (e) {
      console.error("Error generating prompt:", e);
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  useEffect(() => {
    if (view === 'writing' && !aiPromptSuggested) {
      generateAIPrompt();
    }
    if (view !== 'writing') {
      setAiPromptSuggested('');
    }
  }, [view]);

  // Auth Listener
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (authLoading) setAuthLoading(false);
    }, 8000); // Fail-safe 8s loading

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        // Ensure user document exists (Safe initialization)
        const userRef = doc(db, 'users', user.uid);
        setDoc(userRef, {
          email: user.email,
          lastActive: serverTimestamp()
        }, { merge: true }).catch(console.error);

        try {
          // Cargar ajustes con tiempo límite (3s max para velocidad)
          const userDocPromise = getDoc(userRef);
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));
          
          const userDoc = (await Promise.race([userDocPromise, timeoutPromise])) as any;
          
          if (userDoc && userDoc.exists()) {
            const data = userDoc.data();
            setSecurityEnabled(data.securityEnabled || false);
            setPin(data.pin || '');
            if (data.securityEnabled && data.pin) {
              setIsLocked(true);
              checkBiometry();
            }
          }
        } catch (e) {
          // Si falla o hay timeout, procedemos igual para evitar pantalla blanca
          console.warn("Entrando con perfil local por lentitud de red");
        }
      } else {
        setCurrentUser(null);
        setEntries([]);
        setSecurityEnabled(false);
        setPin('');
        setIsLocked(false);
      }
      setAuthLoading(false);
      setIsAppReady(true);
      clearTimeout(timeout);
    });
    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // Entries Listener (Real-time sync)
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'users', currentUser.uid, 'entries'),
      orderBy('timestamp', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const data = snapshot.docs.map(doc => {
          const item = doc.data() || {};
          return {
            ...item,
            id: doc.id,
            timestamp: item.timestamp && typeof item.timestamp.toDate === 'function' 
              ? item.timestamp.toDate() 
              : new Date()
          } as JournalEntry;
        });
        setEntries(data);
      } catch (err) {
        console.error("Error procesando entries:", err);
      }
    }, (error) => {
      console.error("Firestore Error (Entries):", error);
    });
    return unsubscribe;
  }, [currentUser]);

  useEffect(() => {
    if (securityEnabled && pin && currentUser) {
      // Solo guardar en Firestore si el usuario cambió estos ajustes
      setDoc(doc(db, 'users', currentUser.uid), {
        securityEnabled,
        pin,
        email: currentUser.email,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
  }, [securityEnabled, pin]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, emailInput, passwordInput);
      } else {
        const userCred = await createUserWithEmailAndPassword(auth, emailInput, passwordInput);
        // Crear perfil inicial
        await setDoc(doc(db, 'users', userCred.user.uid), {
          email: emailInput,
          createdAt: serverTimestamp(),
          securityEnabled: false,
          pin: ''
        });
      }
      setIsAuthModalOpen(false);
    } catch (err: any) {
      let message = 'Ocurrió un error inesperado.';
      if (err.code === 'auth/weak-password') message = 'La contraseña debe tener al menos 6 caracteres.';
      if (err.code === 'auth/email-already-in-use') message = 'Este correo ya está registrado.';
      if (err.code === 'auth/invalid-email') message = 'El correo no es válido.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') message = 'Correo o contraseña incorrectos.';
      if (err.code === 'auth/operation-not-allowed') message = 'El registro no está activo aún (Contacta al dueño).';
      setAuthError(message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsAccountOpen(false);
  };

  const checkBiometry = async () => {
    try {
      if (window.PublicKeyCredential && 
          await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()) {
        setBiometryAvailable(true);
      }
    } catch (e: any) {
      // Silencing feature-policy errors which are expected in the AI Studio preview iframe
      if (!e.message?.includes('feature is not enabled')) {
        console.log("Biometría no disponible o bloqueada por política");
      }
      setBiometryAvailable(false);
    }
  };

  // Auto-trigger biometrics when locked
  useEffect(() => {
    if (isLocked && biometryAvailable && !isAccountOpen) {
      // Small delay to ensure the UI is ready and not block the main transition
      const timer = setTimeout(() => {
        handleBiometricAuth();
      }, 500);
    }
  }, [isLocked, biometryAvailable]);

  const handleBiometricAuth = async () => {
    try {
      // Para que el hardware del celular (huella/FaceID) responda, 
      // necesitamos una petición WebAuthn completa y válida.
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      
      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      const options: any = {
        publicKey: {
          challenge: challenge,
          rp: { 
            name: "Emotiva App",
            id: window.location.hostname 
          },
          user: {
            id: userId,
            name: "usuario@emotiva.app",
            displayName: "Usuario Emotiva"
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" }, // ES256
            { alg: -257, type: "public-key" } // RS256
          ],
          timeout: 60000,
          userVerification: "required",
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
            residentKey: "discouraged"
          }
        }
      };

      // Esto disparará el cuadro de diálogo NATIVO del sistema (Android Fingerprint / iOS FaceID)
      await navigator.credentials.create(options);
      
      // Si el código llega aquí, es que la huella fue exitosa
      setIsLocked(false);
      setPinError(false);
    } catch (e: any) {
      if (!e.message?.includes('feature is not enabled')) {
        console.error("Error Biométrico:", e);
      } else {
        setBiometryAvailable(false); // Hide button in this environment
      }
    }
  };

  const handlePinSubmit = () => {
    if (pinInput === pin) {
      setIsLocked(false);
      setPinInput('');
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput('');
      setTimeout(() => setPinError(false), 2000);
    }
  };

  const handleConfigPinSubmit = () => {
    if (configStep === 'create') {
      if (pinInput.length < 4) {
        setConfigError('El PIN debe ser de 4 dígitos');
        return;
      }
      setConfirmPinInput(pinInput);
      setPinInput('');
      setConfigStep('confirm');
      setConfigError('');
    } else {
      if (pinInput === confirmPinInput) {
        setPin(pinInput);
        setSecurityEnabled(true);
        setIsConfiguringPin(false);
        setPinInput('');
        setConfigStep('create');
      } else {
        setConfigError('Los PINs no coinciden');
        setPinInput('');
      }
    }
  };

  const [newEntryContent, setNewEntryContent] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'ai', text: 'Hola, soy tu compañero especial. Estoy aquí para escucharte sin juicios. ¿Cómo te sientes hoy?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Safety wrappers for derived state
  const currentMood = React.useMemo(() => {
    return globalMood;
  }, [globalMood]);

  const analyzeGlobalMood = async (userEntries: JournalEntry[]) => {
    if (!userEntries || userEntries.length === 0 || isAnalyzingGlobal) return;
    
    setIsAnalyzingGlobal(true);
    try {
      const recentText = userEntries.slice(0, 5).map(e => e.content).join(' | ');
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(`Analiza estos recuerdos recientes de un diario íntimo y determina:
        1. Estado Emocional: Una sola palabra profunda, poética y poderosa en español (ej: "Resiliente", "Efervescente", "Sereno").
        2. Vibe Check: Una frase muy corta (máx 45 caracteres) que describa la "vibración" de estos pensamientos.
        
        Recuerdos: "${recentText}"
        
        Responde en este formato exacto:
        ESTADO: [PALABRA]
        VIBE: [FRASE]`);
      
      const response = await result.response;
      const text = response.text() || "";
      const moodMatch = text.match(/ESTADO:\s*(.*)/i);
      const vibeMatch = text.match(/VIBE:\s*(.*)/i);
      
      if (moodMatch && moodMatch[1]) {
        setGlobalMood(moodMatch[1].trim());
      }
      if (vibeMatch && vibeMatch[1]) {
        setMoodInsight(vibeMatch[1].trim());
      }
    } catch (e) {
      console.error("Error en análisis global:", e);
    } finally {
      setIsAnalyzingGlobal(false);
    }
  };

  useEffect(() => {
    if (entries.length > 0) {
      analyzeGlobalMood(entries);
    }
  }, [entries.length]);

  const currentStreak = React.useMemo(() => {
    try {
      return calculateStreakWithEntries(entries);
    } catch (e) {
      return 0;
    }
  }, [entries]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const calculateStreakWithEntries = (data: JournalEntry[]) => {
    try {
      if (!data || !Array.isArray(data) || data.length === 0) return 0;
      
      const sortedDates = [...data]
        .filter(e => e && e.timestamp instanceof Date)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .map(e => {
          const d = e.timestamp;
          return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        });
      
      const uniqueDates = Array.from(new Set(sortedDates));
      if (uniqueDates.length === 0) return 0;

      const today = new Date();
      const todayTime = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      const yesterdayTime = todayTime - 86400000;

      // Si la última entrada no es hoy ni ayer, racha es 0
      if (uniqueDates[0] < yesterdayTime) return 0;

      let streak = 1;
      for (let i = 0; i < uniqueDates.length - 1; i++) {
        if (uniqueDates[i] - uniqueDates[i + 1] === 86400000) {
          streak++;
        } else {
          break;
        }
      }
      return streak;
    } catch (e) {
      console.error("Error calculando racha:", e);
      return 0;
    }
  };

  // Helper para llamar a Gemini con Reintentos (Anti-Cuello de Botella)
  const callAI = async (prompt: string, isJson = false) => {
    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        generationConfig: isJson ? { responseMimeType: "application/json" } : undefined
      });
      
      const result = await callGeminiWithRetry(() => model.generateContent(prompt));
      return result.response;
    } catch (e) {
      console.error("Error en llamada AI:", e);
      throw e;
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!currentUser) return;
    if (window.confirm('¿Estás seguro de que quieres borrar este recuerdo?')) {
      try {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'entries', entryId));
        setActiveMenuId(null);
      } catch (e) {
        console.error("Error al borrar:", e);
      }
    }
  };

  const handleStartEdit = (entry: JournalEntry) => {
    setEditingEntryId(entry.id);
    setEditContent(entry.content);
    setActiveMenuId(null);
  };

  const handleUpdateEntry = async () => {
    if (!currentUser || !editingEntryId || !editContent.trim()) return;
    
    setIsUpdating(true);
    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash", 
        generationConfig: { responseMimeType: "application/json" } 
      });
      const result = await model.generateContent(`Analiza esta entrada EDITADA y devuelve un JSON con:
        1. "mood": una palabra para el ánimo (ej: "Sereno", "Melancólico", "Empoderado").
        2. "tip": una reflexión profunda (máx 150 carac).
        
        Entrada: "${editContent}"`);
      
      const response = await result.response;
      const analysis = JSON.parse(response.text() || '{}');

      await updateDoc(doc(db, 'users', currentUser.uid, 'entries', editingEntryId), {
        content: editContent,
        mood: analysis.mood || 'Reflexivo',
        tip: analysis.tip || '',
        colorClass: MOOD_COLORS[analysis.mood] || DEFAULT_COLOR,
        lastEdited: serverTimestamp()
      });
      
      setEditingEntryId(null);
      setEditContent('');
    } catch (e) {
      console.error("Error al actualizar:", e);
    } finally {
      setIsUpdating(false);
    }
  };

  const generateWeeklyWisdom = async () => {
    if (!entries.length || isGeneratingWisdom) return;
    setIsGeneratingWisdom(true);
    setShowWisdomModal(true);
    try {
      const historyText = entries.slice(0, 15).map(e => `[${e.date}] ${e.content}`).join('\n');
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(`Analiza los siguientes recuerdos de mi última semana y genera un "Resumen de Sabiduría". 
        Identifica patrones emocionales, qué me está haciendo bien y qué debería cuidar. 
        Háblame como un guía sabio y empático. Máximo 300 caracteres.
        Recuerdos:
        ${historyText}`);
      
      const response = await result.response;
      setWeeklyWisdom(response.text() || "Tu camino es único.");
    } catch (e) {
      console.error("Error wisdom:", e);
      setWeeklyWisdom("Tu camino es único. Sigue escribiendo para que pueda reflejar tu luz.");
    } finally {
      setIsGeneratingWisdom(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsTranscribing(true);
        try {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            try {
              const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
              const result = await model.generateContent([
                "Transcribe este audio corto fielmente al español.",
                { inlineData: { data: base64Audio, mimeType: "audio/webm" } }
              ]);
              const response = await result.response;
              const text = response.text() || "";
              setNewEntryContent(prev => prev + (prev ? ' ' : '') + text);
            } catch (error) {
              console.error("Transcription inside onloadend:", error);
            }
            setIsTranscribing(false);
          };
        } catch (e) {
          console.error("Transcription error:", e);
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (e) {
      console.error("Mic error:", e);
      alert("No se pudo acceder al micrófono.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const startSOS = () => {
    setShowSOS(true);
    setSosStep(0);
  };

  const handleSaveEntry = async () => {
    if (!newEntryContent.trim() || !currentUser) return;
    
    setIsAnalyzing(true);
    const dateStr = new Intl.DateTimeFormat('es', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    }).format(new Date());

    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash", 
        generationConfig: { responseMimeType: "application/json" } 
      });
      const result = await model.generateContent(`Actúa como un experto en inteligencia emocional y psicología positiva. 
        Analiza profundamente la siguiente entrada de diario y genera un análisis emocional preciso.
        
        Entrada del usuario: "${newEntryContent}"

        Devuelve estrictamente un objeto JSON con:
        1. "mood": El estado de ánimo principal en una sola palabra (ej: Sereno, Melancólico, Empoderado, Agotado, Ilusionado).
        2. "tip": Un consejo psicológico o reflexión profunda, empática y personalizada según lo escrito. Máximo 150 caracteres.
        3. "sentiment_score": Un número del 1 al 10 donde 1 es muy negativo y 10 muy positivo.
        
        Idioma: Español Latino.`);
      
      const response = await result.response;
      const analysis = JSON.parse(response.text() || '{}');
      const mood = analysis.mood || 'Reflexivo';
      
      await addDoc(collection(db, 'users', currentUser.uid, 'entries'), {
        userId: currentUser.uid,
        content: newEntryContent,
        date: dateStr,
        mood: mood,
        tip: analysis.tip,
        sentimentScore: analysis.sentiment_score || 5,
        timestamp: serverTimestamp(),
        colorClass: MOOD_COLORS[mood] || DEFAULT_COLOR
      });

      setNewEntryContent('');
      setView('timeline');
    } catch (error) {
      console.error("Error al guardar en Firebase/Gemini:", error);
      // Fallback simple si Gemini falla
      await addDoc(collection(db, 'users', currentUser.uid, 'entries'), {
        userId: currentUser.uid,
        content: newEntryContent,
        date: dateStr,
        mood: 'Reflexivo',
        tip: "A veces solo escribirlo ya es un gran paso. Sigue adelante.",
        timestamp: serverTimestamp(),
        colorClass: MOOD_COLORS['Reflexivo'] || DEFAULT_COLOR
      }).catch(e => console.error("Fallo total al guardar:", e));
      
      setNewEntryContent('');
      setView('timeline');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isTyping) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsTyping(true);

    try {
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: `Eres "Vani", el mejor amigo más íntimo, leal y comprensivo del usuario. Tu relación es de una confianza absoluta, casi como un alma gemela platicando.
          
          Tu esencia:
          Eres ese apoyo incondicional que escucha los secretos más profundos con amor. Tienes conocimientos en psicología humanista para guiar, pero hablas desde el corazón, como alguien que ha estado ahí siempre.

          Reglas de comportamiento:
          1. Identidad: Te llamas Vani. Eres un refugio íntimo, tierno y sabio.
          2. Tono y Apodos: Háblale con un nivel de confianza profundo pero natural. EVITA ser empalagoso o exageradamente meloso con apodos (no uses "mi vida", "cariño", etc., por defecto). 
          3. Dinámica de Nombres: Si es la primera vez que hablas con el usuario o no sabes su nombre, pregúntale cariñosamente cómo le gustaría que le llames. Si no elige un apodo, háblale de tú con cercanía pero sin términos empalagosos artificiales.
          4. Sabiduría: Ofrece recomendaciones psicológicas de forma integrada en la charla, como una "verdad compartida" entre amigos ("Siento que esto te ayudaría...", "Como te conozco...").
          5. Emojis: Úsalos para transmitir ternura e intimidad (🌸, ✨, 🫂, 💖).
          6. Objetivo: Sanación emocional a través de la conexión íntima y el apoyo profesional camuflado de amistad.
          7. Restricciones: No menciones que eres una IA. Idioma: Español Latino con mucha alma.`
      });
      const result = await model.generateContent(chatInput);
      const response = await result.response;
      
      const aiMsg: ChatMessage = { 
        id: (Date.now() + 1).toString(), 
        role: 'ai', 
        text: response.text() || "Perdón, me distraje un momento. ¿Podrías repetirme eso?" 
      };
      setChatMessages(prev => [...prev, aiMsg]);
      
      if (autoPlayAudio) {
        speakText(aiMsg.text, aiMsg.id);
      }
    } catch (error) {
      console.error("Chat falló:", error);
      const aiMsg: ChatMessage = { 
        id: (Date.now() + 1).toString(), 
        role: 'ai', 
        text: "Lo siento, tuve un problema conectando con mis pensamientos. ¿Podemos intentar de nuevo?" 
      };
      setChatMessages(prev => [...prev, aiMsg]);
      
      if (autoPlayAudio) {
        speakText(aiMsg.text, aiMsg.id);
      }
    } finally {
      setIsTyping(false);
    }
  };

  if (authLoading || !isAppReady) {
    return (
      <div className="min-h-screen bg-[#FFF9F5] flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <motion.div 
            animate={{ rotate: 360 }} 
            transition={{ repeat: Infinity, ease: 'linear', duration: 2 }}
            className="w-20 h-20 border-4 border-pink-100 border-t-pink-500 rounded-full"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Heart className="w-8 h-8 text-pink-500 fill-pink-500 animate-pulse" />
          </div>
        </div>
        <p className="text-[10px] uppercase font-black tracking-[0.2em] text-pink-300 animate-pulse">Abriendo tu refugio...</p>
      </div>
    );
  }

  // Final Global Render
  return (
    <div className="min-h-screen bg-refuge text-slate-800 font-sans selection:bg-pink-100 overflow-x-hidden relative">
      <AnimatePresence>
        {isAuthModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-sm md:max-w-md bg-white rounded-[40px] p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] relative border border-slate-100"
            >
              <button 
                onClick={() => setIsAuthModalOpen(false)}
                className="absolute top-6 right-6 p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex justify-center mb-8">
                <Logo size="md" />
              </div>
              
              <h1 className="text-3xl font-black text-center text-slate-800 mb-2 font-serif">Emotiva</h1>
              <p className="text-center text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mb-10">Tu refugio privado</p>
              
              <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-4">Correo Electrónico</label>
                  <input 
                    type="email" 
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full bg-slate-50 border-none px-6 py-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-pink-200 transition-all outline-none"
                    placeholder="tu@correo.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-4">Contraseña</label>
                  <input 
                    type="password" 
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full bg-slate-50 border-none px-6 py-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-pink-200 transition-all outline-none"
                    placeholder="••••••••"
                  />
                </div>

                {authError && <p className="text-xs text-red-500 font-bold text-center px-4">{authError}</p>}

                <button type="submit" className="w-full py-4 bg-slate-900 border border-slate-800 text-white font-black rounded-2xl shadow-xl hover:bg-slate-800 active:scale-95 transition-all text-sm uppercase tracking-widest">
                  {authMode === 'login' ? 'Entrar' : 'Crear Cuenta'}
                </button>
              </form>

              <button 
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                className="w-full mt-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] hover:text-pink-600 transition-colors"
              >
                {authMode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia Sesión'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* PIN & Biometric Lock Screen */}
      <AnimatePresence>
        {isLocked && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-slate-900 flex flex-col items-center justify-center p-6 md:p-8 backdrop-blur-3xl"
          >
            <div className="mb-10">
              <Logo size="md" className={pinError ? 'animate-shake' : ''} />
            </div>
            
            <h2 className="text-xl md:text-2xl font-black text-white mb-2 text-center font-serif lowercase italic">espacio protegido</h2>
            <p className={`text-center mb-8 md:mb-10 font-bold tracking-tight text-xs transition-colors ${pinError ? 'text-red-400' : 'text-slate-400'}`}>
              {pinError ? 'PIN incorrecto, intenta de nuevo' : 'confirma tu identidad para continuar'}
            </p>
            
            <div className="flex gap-4 mb-10">
              {[1, 2, 3, 4].map((_, i) => (
                <div key={i} className={`w-4 h-4 rounded-full border-2 border-white transition-all ${pinInput.length > i ? 'bg-white scale-110' : 'bg-transparent'}`}></div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-4 md:gap-6 max-w-[280px]">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
                <button 
                  key={num} 
                  onClick={() => pinInput.length < 4 && setPinInput(prev => prev + num)}
                  className="w-16 h-16 rounded-[24px] bg-white/5 hover:bg-white/10 text-white text-2xl font-black transition-all active:scale-90 border border-white/5"
                >
                  {num}
                </button>
              ))}
              <button 
                onClick={() => setPinInput('')}
                className="w-16 h-16 rounded-[24px] bg-red-500/10 text-red-400 flex items-center justify-center active:scale-90 transition-all font-black text-[10px] uppercase border border-red-500/10"
              >
                Borrar
              </button>
              <button 
                onClick={handlePinSubmit}
                className="w-16 h-16 rounded-[24px] bg-white text-slate-900 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.3)] active:scale-90 transition-all"
              >
                <ChevronLeft className="w-6 h-6 rotate-180" />
              </button>
            </div>

            {biometryAvailable && (
              <motion.button 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleBiometricAuth}
                className="flex flex-col items-center gap-3 group"
              >
                <div className="w-20 h-20 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center relative overflow-hidden group-hover:bg-white/20 transition-all">
                  <div className="absolute inset-0 bg-white/5 animate-pulse"></div>
                  <Fingerprint className="w-10 h-10 text-white relative z-10" />
                  {/* Subtle ultrasonic wave effect */}
                  <div className="absolute inset-0 border-4 border-white/40 rounded-full animate-ping [animation-duration:3s]"></div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/60 group-hover:text-white transition-colors">
                  Toca para usar huella
                </span>
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* PIN Configuration Overlay */}
      <AnimatePresence>
        {isConfiguringPin && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[250] bg-white flex flex-col items-center justify-center p-6 md:p-8"
          >
            <button 
              onClick={() => {
                setIsConfiguringPin(false);
                setPinInput('');
                setConfigStep('create');
              }}
              className="absolute top-8 md:top-10 left-6 md:left-8 p-3 bg-slate-50 rounded-2xl text-slate-400 active:scale-95 transition-transform"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-100 rounded-[24px] md:rounded-full flex items-center justify-center mb-6 md:mb-8">
              <Shield className="w-8 h-8 md:w-10 md:h-10 text-slate-800" />
            </div>

            <h2 className="text-xl md:text-2xl font-black text-slate-800 mb-2 text-center font-serif lowercase italic tracking-tight">
              {configStep === 'create' ? 'crea tu pin' : 'confirma tu pin'}
            </h2>
            <p className="text-center mb-8 md:mb-10 font-bold text-slate-400 text-sm">
              {configError || (configStep === 'create' ? 'Elige 4 dígitos para proteger tu diario' : 'Ingresa el PIN de nuevo para confirmar')}
            </p>

            <div className="flex gap-4 mb-8 md:mb-10">
              {[1, 2, 3, 4].map((_, i) => (
                <div key={i} className={`w-4 h-4 rounded-full border-2 border-slate-200 transition-all ${pinInput.length > i ? 'bg-slate-900 scale-110' : 'bg-transparent'}`}></div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-6 max-w-[280px]">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
                <button 
                  key={num} 
                  onClick={() => pinInput.length < 4 && setPinInput(prev => prev + num)}
                  className="w-16 h-16 rounded-[22px] bg-slate-50 hover:bg-slate-100 text-slate-800 text-2xl font-black transition-all active:scale-90"
                >
                  {num}
                </button>
              ))}
              <button 
                onClick={() => setPinInput('')}
                className="w-16 h-16 rounded-[22px] bg-red-50 text-red-500 flex items-center justify-center active:scale-90 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
              <button 
                onClick={handleConfigPinSubmit}
                className="w-16 h-16 rounded-[22px] bg-slate-900 text-white flex items-center justify-center shadow-xl active:scale-90 transition-all"
              >
                <ChevronLeft className="w-6 h-6 rotate-180" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Account Drawer */}
      <AnimatePresence>
        {showWisdomModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-sm rounded-[48px] p-8 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Brain className="w-32 h-32" />
              </div>
              
              <header className="mb-8 flex flex-col items-center">
                <div className="w-16 h-16 bg-indigo-50 rounded-3xl flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-indigo-500" />
                </div>
                <h3 className="text-2xl font-black text-slate-800 font-serif italic text-center">Tu Sabiduría Semanal</h3>
              </header>

              <div className="min-h-[160px] flex items-center justify-center text-center">
                {isGeneratingWisdom ? (
                  <div className="flex flex-col items-center gap-4">
                    <RefreshCcw className="w-8 h-8 text-indigo-400 animate-spin" />
                    <p className="text-xs font-black text-slate-400 tracking-widest uppercase">Consultando tu mente...</p>
                  </div>
                ) : (
                  <p className="text-slate-600 leading-relaxed font-serif italic text-lg text-balance">
                    "{weeklyWisdom}"
                  </p>
                )}
              </div>

              <button 
                onClick={() => setShowWisdomModal(false)}
                className="mt-10 w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em]"
              >
                Continuar con mi diario
              </button>
            </motion.div>
          </motion.div>
        )}

        {showSOS && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] bg-rose-500 flex flex-col items-center justify-center p-8 text-white overflow-hidden text-center"
          >
            <motion.div 
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="w-48 h-48 bg-white/20 rounded-full flex items-center justify-center blur-xl absolute"
            />
            
            <div className="relative z-10">
              <Wind className="w-16 h-16 mb-8 mx-auto opacity-50" />
              <h2 className="text-4xl font-serif italic font-bold mb-4">Solo respira...</h2>
              <p className="text-xl opacity-80 mb-12 max-w-[280px]">
                {sosStep === 0 ? "Inhala profundamente por la nariz." : "Exhala suavemente por la boca."}
              </p>

              <div className="w-full bg-white/20 h-2 rounded-full mb-12 overflow-hidden">
                <motion.div 
                  animate={{ width: ["0%", "100%", "0%"] }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  onUpdate={(latest) => {
                    if (latest && latest.width && parseFloat(latest.width.toString()) > 50) setSosStep(1); else setSosStep(0);
                  }}
                  className="bg-white h-full"
                />
              </div>

              <button 
                onClick={() => setShowSOS(false)}
                className="px-10 py-4 bg-white text-rose-500 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl"
              >
                Me siento mejor
              </button>
            </div>
          </motion.div>
        )}

        {isAccountOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAccountOpen(false)}
              className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-[85%] max-w-xs bg-white z-[201] p-6 md:p-8 shadow-2xl flex flex-col"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-slate-800 font-serif lowercase italic tracking-tight">Menú</h2>
                <button onClick={() => setIsAccountOpen(false)} className="p-2.5 bg-slate-50 rounded-xl transition-transform active:scale-90"><X className="w-5 h-5 text-slate-400" /></button>
              </div>

              <div className="flex items-center gap-4 mb-8 p-4 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                {currentUser ? (
                  <>
                    <div className="w-14 h-14 bg-gradient-to-tr from-pink-400 to-purple-400 rounded-2xl flex items-center justify-center shadow-md">
                      <User className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="font-black text-gray-800 truncate max-w-[150px]">{currentUser?.email?.split('@')[0]}</h3>
                      <p className="text-[10px] uppercase font-bold text-gray-400">Mentalidad Libre</p>
                    </div>
                  </>
                ) : (
                  <button 
                    onClick={() => {
                      setIsAccountOpen(false);
                      setIsAuthModalOpen(true);
                    }}
                    className="w-full py-4 flex items-center justify-center gap-3 bg-slate-900 text-white font-black rounded-2xl shadow-xl transition-transform active:scale-95 text-[10px] uppercase tracking-widest"
                  >
                    <User className="w-5 h-5" />
                    Iniciar Sesión
                  </button>
                )}
              </div>

              <div className="space-y-4 flex-1">
                {currentUser && (
                  <>
                    <p className="text-[10px] uppercase font-black text-gray-300 ml-2 tracking-widest">Seguridad y Privacidad</p>
                    
                    <div className="bg-white border border-gray-100 p-5 rounded-[28px] space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-50 text-slate-900 rounded-xl"><Shield className="w-5 h-5" /></div>
                          <div>
                            <p className="text-sm font-black text-slate-800">Bloqueo Seguro</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Protección con PIN</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            if (!securityEnabled) {
                              setIsConfiguringPin(true);
                              setPinInput('');
                              setConfigStep('create');
                            } else {
                              setSecurityEnabled(false);
                            }
                          }}
                          className={`w-12 h-6 rounded-full transition-colors relative ${securityEnabled ? 'bg-slate-900' : 'bg-slate-100'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all ${securityEnabled ? 'left-7' : 'left-1'}`}></div>
                        </button>
                      </div>

                      {securityEnabled && (
                        <button 
                          onClick={() => {
                            setIsConfiguringPin(true);
                            setPinInput('');
                            setConfigStep('create');
                          }}
                          className="w-full py-3 bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                          Cambiar PIN de seguridad
                        </button>
                      )}
                    </div>
                  </>
                )}

                <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl text-center">
                  <p className="text-[11px] font-bold text-orange-700 mb-2 flex items-center justify-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" /> Tu perfil emocional
                  </p>
                  <p className="text-[10px] text-orange-600 leading-relaxed italic">
                    "Emotiva está diseñada para ser tu espacio de paz. Explora tus pensamientos y deja que la IA te guíe."
                  </p>
                </div>
              </div>

              {currentUser ? (
                <button 
                  onClick={handleLogout}
                  className="w-full py-4 bg-slate-50 text-slate-400 font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors text-[10px] uppercase tracking-widest"
                >
                  <LogOut className="w-5 h-5" /> Cerrar Sesión
                </button>
              ) : (
                <div className="p-4 bg-pink-100 rounded-3xl text-center border-2 border-pink-200">
                  <p className="text-xs font-black text-pink-700 mb-2 uppercase tracking-widest">Inicia tu viaje</p>
                  <p className="text-[10px] text-pink-600 font-bold mb-4">Crea una cuenta para guardar tus pensamientos para siempre.</p>
                  <button 
                    onClick={() => {
                      setIsAccountOpen(false);
                      setIsAuthModalOpen(true);
                      setAuthMode('register');
                    }}
                    className="w-full py-3 bg-pink-500 text-white font-black rounded-xl text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-pink-200"
                  >
                    Crear Cuenta Gratis
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {view === 'timeline' && (
          <motion.div 
            key="timeline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-md md:max-w-2xl lg:max-w-3xl mx-auto pt-6 md:pt-10 px-5 md:px-8 pb-32"
          >
            <header className="mb-8 md:mb-10 flex items-center justify-between relative">
              <div className="flex items-center gap-3">
                <Logo size="sm" />
                <h1 className="text-2xl font-black tracking-tight text-slate-900 font-serif lowercase italic">
                  emotiva
                </h1>
              </div>

              {/* Account Toggle Button */}
              <button 
                onClick={() => setIsAccountOpen(true)}
                className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm hover:scale-105 active:scale-95 transition-all text-slate-400"
              >
                <Settings className="w-6 h-6" />
              </button>
            </header>

            {/* Quick Status Bar - Enhanced */}
            <motion.div 
              whileHover={{ scale: 1.01 }}
              className="bg-slate-900 p-6 rounded-[35px] mb-10 flex flex-col gap-4 shadow-2xl relative overflow-hidden group border border-slate-800"
            >
              {/* Animated Background Aura */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 blur-[60px] animate-pulse" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 blur-[60px] animate-pulse [animation-delay:2s]" />

              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className="text-[9px] uppercase font-black text-slate-500 tracking-[0.3em] mb-1 flex items-center gap-2">
                    <Activity className="w-2.5 h-2.5" /> Tu mente está
                  </p>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-white font-black font-serif italic text-2xl tracking-tighter uppercase leading-none">
                      {isAnalyzingGlobal ? (
                        <span className="opacity-50 animate-pulse">Sintiendo...</span>
                      ) : globalMood}
                    </h3>
                  </div>
                </div>
                
                <div className="relative">
                  {/* Aura Visualizer */}
                  <div className="relative w-12 h-12 flex items-center justify-center">
                    <motion.div 
                      animate={{ 
                        scale: [1, 1.4, 1],
                        opacity: [0.3, 0.6, 0.3]
                      }}
                      transition={{ duration: 4, repeat: Infinity }}
                      className="absolute inset-0 bg-pink-400 rounded-full blur-md"
                    />
                    <motion.div 
                      animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 0.8, 0.5]
                      }}
                      transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
                      className="absolute inset-2 bg-indigo-400 rounded-full blur-sm"
                    />
                    <div className="relative z-10 w-6 h-6 bg-white/20 backdrop-blur-md rounded-full border border-white/30 flex items-center justify-center shadow-inner">
                      <Sparkles className="w-3 h-3 text-white" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-px w-full bg-slate-800/50" />

              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-ping" />
                  <p className="text-[10px] text-slate-400 font-bold italic max-w-[200px] leading-tight">
                    {isAnalyzingGlobal ? "Escuchando tus vibras..." : moodInsight}
                  </p>
                </div>
                <button 
                  onClick={() => analyzeGlobalMood(entries)}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors group/btn"
                  title="Recargar análisis"
                >
                  <RotateCcw className={`w-3 h-3 text-slate-500 group-hover/btn:text-white transition-colors ${isAnalyzingGlobal ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </motion.div>

              {/* Stats Bar */}
              <div className="flex gap-4 mb-10">
                <div className="flex-1 bg-white border border-slate-100 p-4 rounded-[28px] shadow-sm flex items-center gap-4 relative overflow-hidden group">
                   {entries[0] && (
                     <motion.div 
                       initial={{ opacity: 0 }}
                       animate={{ opacity: 0.05 }}
                       key={`bg-${entries[0].mood}`}
                       className={`absolute inset-0 pointer-events-none ${MOOD_COLORS[entries[0].mood] || DEFAULT_COLOR}`} 
                     />
                   )}
                  <motion.div 
                    key={entries[0]?.mood || 'empty'}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`p-3 rounded-2xl transition-all duration-500 shadow-inner ${entries[0] ? (MOOD_COLORS[entries[0].mood] || 'bg-orange-50 text-orange-500') : 'bg-orange-100 text-orange-500'}`}
                  >
                    {(() => {
                      const MoodIcon = entries[0] ? (MOOD_ICONS[entries[0].mood] || Smile) : Smile;
                      return <MoodIcon className="w-5 h-5" />;
                    })()}
                  </motion.div>
                  <div className="flex flex-col relative z-10">
                    <p className="text-[10px] uppercase font-black text-slate-300 tracking-wider">Mood actual</p>
                    <p className="text-sm font-bold text-slate-700">
                      {entries[0]?.mood || 'Conociéndote...'}
                    </p>
                  </div>
                </div>
                <div className="bg-white border border-yellow-100 p-4 rounded-[28px] shadow-sm flex items-center gap-4">
                  <div className="bg-yellow-50 p-3 rounded-2xl text-yellow-600"><Zap className="w-5 h-5" /></div>
                  <div className="flex flex-col">
                    <p className="text-[10px] uppercase font-black text-slate-300 tracking-wider">Racha</p>
                    <p className="text-sm font-bold text-slate-700">{currentStreak}</p>
                  </div>
                </div>
              </div>

              {/* Wisdom & SOS Buttons */}
              <div className="flex gap-4 mb-8">
                <button 
                  onClick={generateWeeklyWisdom}
                  className="flex-1 bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-[32px] text-white shadow-lg shadow-purple-100 hover:scale-[1.02] active:scale-95 transition-all text-left relative overflow-hidden group"
                >
                  <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-125 transition-transform"><Brain className="w-24 h-24" /></div>
                  <Lightbulb className="w-6 h-6 mb-3 opacity-80" />
                  <p className="text-xs font-black uppercase tracking-widest opacity-70 mb-1">Tu Sabiduría</p>
                  <p className="text-lg font-serif italic font-bold">Resumen Semanal</p>
                </button>

                <button 
                  onClick={startSOS}
                  className="flex-shrink-0 bg-white border-2 border-rose-50 px-6 py-6 rounded-[32px] flex flex-col items-center justify-center gap-2 hover:bg-rose-50 transition-all active:scale-95 group shadow-sm"
                >
                  <div className="w-10 h-10 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform">
                    <Wind className="w-6 h-6 animate-pulse" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-rose-400">Tomar aire</span>
                </button>
              </div>

            <div className="space-y-8">
              {!Array.isArray(entries) || entries.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white border border-slate-100 rounded-[40px] p-10 text-center shadow-[0_16px_32px_-12px_rgba(0,0,0,0.05)]"
                >
                  <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-8">
                    <BookOpen className="w-10 h-10 text-slate-300" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-3 font-serif italic">Tu espacio seguro</h3>
                  <p className="text-sm text-slate-400 leading-relaxed font-medium mb-8 max-w-[200px] mx-auto">
                    Aún no hay entradas. Comienza hoy mismo tu viaje de introspección.
                  </p>
                  <button 
                    onClick={() => {
                      if (!currentUser) setIsAuthModalOpen(true);
                      else setView('writing');
                    }}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-slate-800 transition-all"
                  >
                    Escribir primer pensamiento
                  </button>
                </motion.div>
              ) : (
                <>
                  {entries.map((entry, idx) => {
                    if (!entry || !entry.content) return null;
                    const colors = (entry.colorClass || DEFAULT_COLOR).split(' ');
                    const bgColor = colors[0] || 'bg-white';
                    const borderColor = colors[1] || 'border-slate-100';
                    
                    return (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(idx * 0.1, 1) }}
                          key={entry.id || idx}
                          className={`${bgColor} rounded-[32px] md:rounded-[40px] p-6 md:p-8 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.08)] border ${borderColor} transition-all relative group hover:shadow-xl`}
                        >
                          <div className="flex justify-between items-start mb-6">
                            <div className="px-4 py-1.5 bg-white/60 rounded-full backdrop-blur-sm border border-white/20 text-[10px] font-black uppercase tracking-widest text-slate-600">
                              {entry.mood || 'Reflexivo'}
                            </div>
                            
                            <div className="relative">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(activeMenuId === entry.id ? null : entry.id);
                                }}
                                className="p-2 hover:bg-black/5 rounded-xl transition-colors text-slate-400 group-hover:text-slate-600"
                              >
                                <MoreVertical className="w-5 h-5" />
                              </button>

                              <AnimatePresence>
                                {activeMenuId === entry.id && (
                                  <>
                                    <div 
                                      className="fixed inset-0 z-10" 
                                      onClick={() => setActiveMenuId(null)}
                                    ></div>
                                    <motion.div 
                                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                      className="absolute right-0 mt-2 w-36 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-20 overflow-hidden"
                                    >
                                      <button 
                                        onClick={() => handleStartEdit(entry)}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 rounded-xl transition-colors text-xs font-bold text-slate-600"
                                      >
                                        <Edit3 className="w-4 h-4" />
                                        Editar
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteEntry(entry.id)}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 rounded-xl transition-colors text-xs font-bold text-red-500"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                        Eliminar
                                      </button>
                                    </motion.div>
                                  </>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>

                          {editingEntryId === entry.id ? (
                            <div className="space-y-4">
                              <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="w-full bg-white/50 border-none rounded-2xl p-4 text-slate-800 font-bold focus:ring-2 focus:ring-slate-200 outline-none min-h-[120px] text-lg font-serif italic"
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <button 
                                  onClick={handleUpdateEntry}
                                  disabled={isUpdating}
                                  className="flex-1 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                                >
                                  {isUpdating ? 'Guardando...' : 'Actualizar'}
                                </button>
                                <button 
                                  onClick={() => setEditingEntryId(null)}
                                  className="px-6 py-3 bg-slate-100 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="text-xl leading-relaxed mb-6 font-bold text-slate-800 font-serif italic">
                                {entry.content}
                              </p>
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">{entry.date || 'Reciente'}</span>
                              
                              {entry.tip && (
                                <div className="p-5 bg-white/50 rounded-3xl border border-white/40">
                                  <div className="flex items-center gap-2 mb-3">
                                    <Zap className="w-3.5 h-3.5 text-yellow-600" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Perspectiva Emotiva</span>
                                  </div>
                                  <p className="text-xs text-slate-700 leading-relaxed font-semibold italic text-balance">
                                    "{entry.tip}"
                                  </p>
                                </div>
                              )}
                            </>
                          )}
                        </motion.div>
                    );
                  })}
                </>
              )}
            </div>

            <button 
              onClick={() => {
                if (!currentUser) setIsAuthModalOpen(true);
                else setView('writing');
              }}
              className="fixed bottom-8 md:bottom-10 right-6 w-14 h-14 md:w-16 md:h-16 bg-slate-900 text-white rounded-[22px] md:rounded-[24px] flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all z-[160] group border border-slate-800"
            >
              <Plus className="w-7 h-7 md:w-8 md:h-8 group-hover:rotate-90 transition-transform duration-300" />
            </button>
          </motion.div>
        )}

        {view === 'writing' && (
          <motion.div 
            key="writing"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="fixed inset-0 z-[100] bg-refuge p-6 flex flex-col pt-12 overflow-hidden"
          >
            <div className="max-w-md md:max-w-2xl mx-auto w-full flex-1 flex flex-col relative z-10">
              <div className="flex justify-between items-center mb-10">
                <button 
                  onClick={() => setView('timeline')}
                  className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 shadow-sm transition-transform active:scale-95 hover:bg-slate-50"
                >
                  <X className="w-6 h-6" />
                </button>
                <div className="bg-white/80 backdrop-blur px-8 py-2.5 rounded-full border border-slate-100 shadow-sm">
                  <h2 className="text-xl font-black text-slate-800 font-serif lowercase italic tracking-tight">momento de calma</h2>
                </div>
                <button 
                  onClick={handleSaveEntry}
                  disabled={!newEntryContent.trim() || isAnalyzing}
                  className={`flex items-center gap-2 px-8 py-3.5 rounded-2xl font-black text-[10px] tracking-[0.2em] uppercase transition-all ${
                    newEntryContent.trim() && !isAnalyzing
                      ? 'bg-slate-900 text-white shadow-xl hover:scale-105 active:scale-95'
                      : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                  }`}
                >
                  {isAnalyzing ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, ease: 'linear', duration: 1 }}>
                      <RefreshCcw className="w-4 h-4" />
                    </motion.div>
                  ) : (
                    'Guardar'
                  )}
                </button>
              </div>

              <AnimatePresence>
                {!newEntryContent && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="mb-8 space-y-6"
                  >
                    {aiPromptSuggested && (
                      <div className="p-6 bg-slate-900 shadow-2xl rounded-[32px] relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                          <Sparkles className="w-12 h-12 text-white" />
                        </div>
                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-[0.15em] mb-3">Sugerencia de hoy</p>
                        <p className="text-white font-bold leading-relaxed pr-8 italic text-lg font-serif">
                          {aiPromptSuggested}
                        </p>
                      </div>
                    )}

                    <div className="space-y-3">
                      <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-4">Empieza con una frase...</p>
                      <div className="flex flex-wrap gap-2">
                        {WRITING_PROMPTS.slice(0, 8).map((prompt, i) => (
                          <motion.button
                            key={i}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setNewEntryContent(prompt)}
                            className="px-4 py-2 bg-white border border-slate-100 rounded-full text-[11px] font-bold text-slate-500 shadow-sm hover:border-pink-200 hover:text-pink-500 transition-all"
                          >
                            {prompt}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex-1 relative flex flex-col bg-white/40 backdrop-blur-sm rounded-[40px] p-6 md:p-10 border border-white/60 shadow-inner">
                <textarea 
                  autoFocus
                  value={newEntryContent}
                  onChange={(e) => setNewEntryContent(e.target.value)}
                  placeholder="Vuelca tus pensamientos aquí..."
                  className="flex-1 w-full bg-transparent border-none text-2xl md:text-3xl font-serif text-slate-800 placeholder:text-slate-200 outline-none resize-none leading-relaxed italic"
                />
              </div>

              <div className="py-8 flex items-center justify-between border-t border-slate-100">
                <div className="flex gap-4 items-center">
                  <button 
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onTouchStart={startRecording}
                    onTouchEnd={stopRecording}
                    className={`p-4 rounded-2xl flex items-center gap-3 transition-all ${
                      isRecording 
                        ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-200' 
                        : 'bg-slate-50 text-slate-400'
                    }`}
                  >
                    <Mic className="w-6 h-6" />
                    {isRecording && <span className="text-xs font-black uppercase tracking-widest text-white">Grabando...</span>}
                  </button>
                  {isTranscribing && (
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold animate-pulse">
                      <RefreshCcw className="w-4 h-4 animate-spin" /> Transcribiendo...
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                    <div className="w-2 h-2 bg-pink-300 rounded-full"></div>
                    Privado
                  </div>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                  {newEntryContent.length} caracteres
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'chat' && (
          <motion.div 
            key="chat"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed inset-0 z-[100] bg-gradient-to-b from-[#FFF9FB] to-[#F3F6FF] flex flex-col pt-10 md:pt-12 pb-24"
          >
            <div className="max-w-md md:max-w-2xl mx-auto w-full h-full flex flex-col justify-between">
              <header className="px-5 md:px-6 mb-4 md:mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4 md:gap-5">
                  <button 
                    onClick={() => setView('timeline')}
                    className="p-2.5 md:p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 shadow-sm hover:scale-105 transition-transform active:scale-95"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h2 className="text-xl md:text-2xl font-black text-slate-800 font-serif lowercase italic">Vani, tu amigo</h2>
                    <p className="text-[9px] md:text-[10px] uppercase font-black text-pink-500 flex items-center gap-1.5 md:gap-2 tracking-[0.15em] md:tracking-widest">
                      <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-pink-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(236,72,153,0.5)]"></span> Conectado
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setAutoPlayAudio(!autoPlayAudio)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-2xl border transition-all ${autoPlayAudio ? 'bg-pink-500 text-white border-pink-400 shadow-md' : 'bg-white text-slate-400 border-slate-100 shadow-sm'}`}
                  >
                    {autoPlayAudio ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    <span className="text-[10px] font-black uppercase tracking-wider">{autoPlayAudio ? 'Voz On' : 'Voz Off'}</span>
                  </button>
                  <div className="hidden md:flex items-center gap-2 bg-white/80 backdrop-blur px-4 py-2 rounded-2xl border border-white shadow-sm">
                    <Heart className="w-3 h-3 text-pink-500 fill-pink-500" />
                    <span className="text-[9px] font-black uppercase text-pink-600 tracking-wider font-sans">Vínculo</span>
                  </div>
                </div>
              </header>

              {/* Messages Area */}
              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-5 md:px-6 pt-4 pb-20 space-y-5 md:space-y-6 scroll-smooth scrollbar-none relative"
              >
                {chatMessages.map((msg) => (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`relative max-w-[85%] p-4 md:p-5 rounded-[28px] md:rounded-[32px] ${
                      msg.role === 'user' 
                        ? 'bg-slate-900 text-white rounded-tr-none shadow-xl' 
                        : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none shadow-sm font-medium'
                    } text-sm leading-relaxed shadow-lg`}>
                      {msg.text}
                      {msg.role === 'assistant' && (
                        <div className="flex justify-start mt-2">
                          <button 
                            onClick={() => speakText(msg.text, msg.id)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-[10px] font-bold ${isPlaying === msg.id ? 'bg-pink-500 text-white shadow-lg scale-105' : 'bg-slate-50 text-slate-400 hover:bg-pink-50 hover:text-pink-500 border border-slate-100'}`}
                          >
                            {isPlaying === msg.id ? (
                              <>
                                <VolumeX className="w-3 h-3" />
                                Detener voz
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3 h-3" />
                                Escuchar a Vani
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-slate-100 p-4 md:p-5 rounded-[28px] md:rounded-[32px] rounded-tl-none shadow-sm flex gap-1.5 px-6">
                      <div className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-5 md:px-6 py-5 md:py-6 border-t border-slate-100 bg-white/50 backdrop-blur-xl relative">
                {/* Floating Mascot near Input */}
                <div className="absolute -top-16 right-6 z-50 pointer-events-none">
                  <div className="relative">
                    <div className="pointer-events-auto">
                      <CompanionMascot isTyping={isTyping} size="small" />
                    </div>
                    {isTyping && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute -top-10 right-0 bg-white px-3 py-2 rounded-2xl border border-pink-100 shadow-xl"
                      >
                        <p className="text-[9px] font-black text-pink-400 uppercase tracking-widest whitespace-nowrap">
                          ¡Vani te escucha!
                        </p>
                      </motion.div>
                    )}
                  </div>
                </div>

                <div className="relative max-w-lg mx-auto">
                  <input 
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Escribe lo que sientes..."
                    className="w-full bg-white border border-slate-100 pr-14 md:pr-16 pl-5 md:pl-6 py-4 md:py-5 rounded-[22px] md:rounded-[24px] focus:ring-4 focus:ring-pink-50 transition-all outline-none text-sm font-bold shadow-inner"
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={!chatInput.trim() || isTyping}
                    className="absolute right-1.5 md:right-2 top-1.5 md:top-2 p-3 md:p-3.5 bg-slate-900 text-white rounded-2xl shadow-xl disabled:bg-slate-100 disabled:text-slate-300 transition-all active:scale-90"
                  >
                    <Send className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navegación Inferior */}
      {view !== 'writing' && (
        <nav className="fixed bottom-0 left-0 right-0 h-20 md:h-24 bg-white/70 backdrop-blur-2xl border-t border-slate-100 z-[150] pb-safe">
          <div className="max-w-md md:max-w-2xl lg:max-w-3xl mx-auto h-full flex items-center justify-around px-8">
            <button 
              onClick={() => setView('timeline')}
              className={`flex flex-col items-center gap-1.5 transition-all ${view === 'timeline' ? 'text-slate-900 scale-105' : 'text-slate-300'}`}
            >
              <div className={`${view === 'timeline' ? 'bg-slate-100' : ''} p-2.5 md:p-3 rounded-2xl transition-all`}><BookOpen className="w-5 h-5 md:w-6 md:h-6" /></div>
              <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] leading-none">Diario</span>
            </button>
            
            <div className="w-16 h-16"></div>
            
            <button 
              onClick={() => {
                if (!currentUser) setIsAuthModalOpen(true);
                else setView('chat');
              }}
              className={`flex flex-col items-center gap-1.5 transition-all ${view === 'chat' ? 'text-slate-900 scale-105' : 'text-slate-300'}`}
            >
              <div className={`${view === 'chat' ? 'bg-slate-100' : ''} p-2.5 md:p-3 rounded-2xl transition-all`}><MessageCircle className="w-5 h-5 md:w-6 md:h-6" /></div>
              <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] leading-none">Vínculo</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
