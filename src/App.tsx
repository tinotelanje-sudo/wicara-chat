import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  MoreVertical, 
  MessageSquare, 
  Phone, 
  Video, 
  Paperclip, 
  Smile, 
  Send, 
  User as UserIcon, 
  Settings, 
  LogOut, 
  Moon, 
  Sun, 
  MapPin, 
  Users, 
  Bell, 
  Shield, 
  Globe, 
  ArrowLeft,
  Camera,
  Mic,
  X,
  Plus,
  Bot
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Message, ChatSession, Story } from './types';
import { cn, formatTime, generateId } from './utils';
import { getAIChatbotResponse, translateMessage } from './services/geminiService';

// Mock current user for demo - now managed by state
const INITIAL_USER: User | null = null;

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(INITIAL_USER);
  const [authMode, setAuthMode] = useState<'email' | 'phone' | 'ip'>('email');
  const [authValue, setAuthValue] = useState('');
  const [authName, setAuthName] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const [sessions, setSessions] = useState<ChatSession[]>([
    { id: 'ai_bot', name: 'Wicara AI Support', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=wicara', lastMessage: 'Apa khabar? Saya sedia membantu.', lastMessageTime: new Date().toISOString(), unreadCount: 0, isGroup: false, type: 'ai' },
    { id: 'user_2', name: 'Ahmad', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ahmad', lastMessage: 'Jom makan?', lastMessageTime: new Date().toISOString(), unreadCount: 2, isGroup: false, type: 'individual' },
    { id: 'group_1', name: 'Keluarga Bahagia', avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=family', lastMessage: 'Mak: Nanti balik awal ya.', lastMessageTime: new Date().toISOString(), unreadCount: 0, isGroup: true, type: 'group' },
  ]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNearby, setShowNearby] = useState(false);
  const [showCall, setShowCall] = useState<{ type: 'voice' | 'video', active: boolean }>({ type: 'voice', active: false });
  const [nearbyUsers, setNearbyUsers] = useState<User[]>([]);
  const [stories, setStories] = useState<Story[]>([
    { id: 's1', userId: 'user_2', userName: 'Ahmad', userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ahmad', content: 'https://picsum.photos/seed/story1/400/700', type: 'image', createdAt: new Date().toISOString() }
  ]);

  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleAuth = async () => {
    if (authMode !== 'ip' && !authValue.trim()) return;
    setIsLoggingIn(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: authValue,
          type: authMode,
          name: authName
        })
      });
      const user = await response.json();
      setCurrentUser(user);
      // Save to local storage for persistence
      localStorage.setItem('wicara_user', JSON.stringify(user));
    } catch (error) {
      console.error("Auth error:", error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Load user from local storage
  useEffect(() => {
    const savedUser = localStorage.getItem('wicara_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  // Initialize WebSocket
  useEffect(() => {
    if (!currentUser) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'auth', userId: currentUser.id }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'chat') {
        setMessages(prev => [...prev, data]);
        // Update session last message
        setSessions(prev => prev.map(s => {
          if (s.id === data.senderId || s.id === data.groupId) {
            return { ...s, lastMessage: data.content, lastMessageTime: data.timestamp };
          }
          return s;
        }));
      } else if (data.type === 'typing') {
        setIsTyping(data.isTyping);
      } else if (data.type === 'call-request') {
        // Handle incoming call
        if (confirm(`Incoming ${data.callType} call from ${data.senderName}. Accept?`)) {
          setShowCall({ type: data.callType, active: true });
        }
      }
    };

    return () => socket.close();
  }, [currentUser?.id]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!currentUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8 rounded-3xl bg-white p-8 shadow-xl dark:bg-zinc-900"
        >
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30">
              <MessageSquare className="h-8 w-8" />
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">Wicara</h2>
            <p className="mt-2 text-zinc-500">Daftar atau Log Masuk untuk bermula</p>
          </div>

          <div className="flex gap-2 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
            {(['email', 'phone', 'ip'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setAuthMode(mode)}
                className={cn(
                  "flex-1 rounded-lg py-2 text-xs font-medium transition-all",
                  authMode === mode ? "bg-white shadow-sm dark:bg-zinc-700" : "text-zinc-500 hover:text-zinc-700"
                )}
              >
                {mode === 'email' ? 'Email' : mode === 'phone' ? 'Telefon' : 'IP Address'}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {authMode !== 'ip' && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  {authMode === 'email' ? 'Alamat Email' : 'Nombor Telefon'}
                </label>
                <input
                  type={authMode === 'email' ? 'email' : 'tel'}
                  value={authValue}
                  onChange={(e) => setAuthValue(e.target.value)}
                  placeholder={authMode === 'email' ? 'contoh@email.com' : '+60123456789'}
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-800"
                />
              </div>
            )}
            
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Nama Anda</label>
              <input
                type="text"
                value={authName}
                onChange={(e) => setAuthName(e.target.value)}
                placeholder="Nama Penuh"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-800"
              />
            </div>

            <button
              onClick={handleAuth}
              disabled={isLoggingIn}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {isLoggingIn ? 'Memproses...' : 'Masuk Sekarang'}
              <ArrowLeft className="h-4 w-4 rotate-180" />
            </button>
            
            {authMode === 'ip' && (
              <p className="text-center text-[10px] text-zinc-400">
                Log masuk menggunakan alamat IP anda secara automatik.
              </p>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeSession) return;

    const newMsg: Message = {
      id: generateId(),
      senderId: currentUser.id,
      receiverId: activeSession.type === 'individual' ? activeSession.id : undefined,
      groupId: activeSession.type === 'group' ? activeSession.id : undefined,
      content: inputText,
      type: 'text',
      timestamp: new Date().toISOString(),
      isRead: false
    };

    setMessages(prev => [...prev, newMsg]);
    setInputText('');

    if (activeSession.type === 'ai') {
      const aiResponse = await getAIChatbotResponse(inputText);
      const aiMsg: Message = {
        id: generateId(),
        senderId: 'ai_bot',
        receiverId: currentUser.id,
        content: aiResponse,
        type: 'text',
        timestamp: new Date().toISOString(),
        isRead: true
      };
      setMessages(prev => [...prev, aiMsg]);
    } else {
      socketRef.current?.send(JSON.stringify({
        type: 'chat',
        senderId: currentUser.id,
        receiverId: activeSession.type === 'individual' ? activeSession.id : undefined,
        groupId: activeSession.type === 'group' ? activeSession.id : undefined,
        content: inputText,
        msgType: 'text'
      }));
    }
  };

  const handleTranslate = async (msgId: string, text: string) => {
    const translated = await translateMessage(text, currentUser.language || 'en');
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: translated } : m));
  };

  const startCall = (type: 'voice' | 'video') => {
    if (!activeSession) return;
    setShowCall({ type, active: true });
    socketRef.current?.send(JSON.stringify({
      type: 'call-request',
      senderId: currentUser.id,
      senderName: currentUser.name,
      receiverId: activeSession.id,
      callType: type
    }));
  };

  const findNearby = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      // In a real app, we'd send this to the server
      setNearbyUsers([
        { id: 'u3', name: 'Siti', email: 'siti@example.com', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Siti', latitude: latitude + 0.001, longitude: longitude + 0.001 },
        { id: 'u4', name: 'Zul', email: 'zul@example.com', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zul', latitude: latitude - 0.001, longitude: longitude - 0.001 },
      ]);
      setShowNearby(true);
    });
  };

  return (
    <div className={cn("flex h-screen overflow-hidden bg-zinc-50 font-sans text-zinc-900", currentUser.theme === 'dark' && "dark bg-zinc-950 text-zinc-100")}>
      {/* Sidebar */}
      <div className="flex w-full flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:w-80 lg:w-96">
        {/* Header */}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <img src={currentUser.avatar} alt="Me" className="h-10 w-10 rounded-full border border-zinc-200 dark:border-zinc-700" />
            <h1 className="text-xl font-bold tracking-tight">Wicara</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowSettings(true)} className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <Settings className="h-5 w-5" />
            </button>
            <button onClick={findNearby} className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <MapPin className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Stories */}
        <div className="flex gap-4 overflow-x-auto p-4 scrollbar-hide">
          <div className="flex flex-col items-center gap-1">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-700">
              <Plus className="h-6 w-6 text-zinc-400" />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Anda</span>
          </div>
          {stories.map(story => (
            <div key={story.id} className="flex flex-col items-center gap-1">
              <div className="h-14 w-14 rounded-full border-2 border-emerald-500 p-0.5">
                <img src={story.userAvatar} alt={story.userName} className="h-full w-full rounded-full object-cover" />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">{story.userName}</span>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Cari chat..." 
              className="w-full rounded-xl bg-zinc-100 py-2 pl-10 pr-4 text-sm focus:outline-none dark:bg-zinc-800"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {sessions.map(session => (
            <div 
              key={session.id}
              onClick={() => setActiveSession(session)}
              className={cn(
                "flex cursor-pointer items-center gap-3 border-b border-zinc-50 p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50",
                activeSession?.id === session.id && "bg-zinc-100 dark:bg-zinc-800"
              )}
            >
              <div className="relative">
                <img src={session.avatar} alt={session.name} className="h-12 w-12 rounded-full" />
                {session.type === 'ai' && <Bot className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 p-0.5 text-white" />}
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-between">
                  <h3 className="truncate font-semibold">{session.name}</h3>
                  <span className="text-[10px] text-zinc-400">{formatTime(session.lastMessageTime || '')}</span>
                </div>
                <p className="truncate text-xs text-zinc-500">{session.lastMessage}</p>
              </div>
              {session.unreadCount > 0 && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
                  {session.unreadCount}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="hidden flex-1 flex-col bg-zinc-50 dark:bg-zinc-950 md:flex">
        {activeSession ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-3">
                <img src={activeSession.avatar} alt={activeSession.name} className="h-10 w-10 rounded-full" />
                <div>
                  <h2 className="font-bold">{activeSession.name}</h2>
                  <p className="text-xs text-emerald-500">{isTyping ? 'Sedang menaip...' : 'Atas talian'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={() => startCall('voice')} className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <Phone className="h-5 w-5" />
                </button>
                <button onClick={() => startCall('video')} className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <Video className="h-5 w-5" />
                </button>
                <button className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <MoreVertical className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.filter(m => m.receiverId === activeSession.id || m.senderId === activeSession.id || m.groupId === activeSession.id).map((msg, idx) => (
                <div 
                  key={msg.id} 
                  className={cn(
                    "flex flex-col max-w-[70%]",
                    msg.senderId === currentUser.id ? "ml-auto items-end" : "items-start"
                  )}
                >
                  <div 
                    className={cn(
                      "rounded-2xl px-4 py-2 text-sm shadow-sm",
                      msg.senderId === currentUser.id 
                        ? "bg-emerald-600 text-white rounded-tr-none" 
                        : "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-tl-none"
                    )}
                  >
                    <p>{msg.content}</p>
                    <div className="mt-1 flex items-center justify-end gap-1">
                      <span className="text-[9px] opacity-70">{formatTime(msg.timestamp)}</span>
                      {msg.senderId === currentUser.id && (
                        <div className="flex">
                          <span className="text-[9px] text-emerald-200">✓✓</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleTranslate(msg.id, msg.content)}
                    className="mt-1 text-[10px] text-zinc-400 hover:text-emerald-500"
                  >
                    Terjemah
                  </button>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4">
              <div className="flex items-center gap-2 rounded-2xl bg-white p-2 shadow-sm dark:bg-zinc-900">
                <button className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <Smile className="h-6 w-6" />
                </button>
                <button className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <Paperclip className="h-6 w-6" />
                </button>
                <input 
                  type="text" 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Mesej..." 
                  className="flex-1 bg-transparent px-2 py-1 text-sm focus:outline-none"
                />
                <button 
                  onClick={handleSendMessage}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white transition-transform hover:scale-105 active:scale-95"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30">
              <MessageSquare className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Selamat Datang ke Wicara</h2>
            <p className="mt-2 max-w-xs text-zinc-500">Pilih sembang untuk mula menghantar mesej dengan selamat dan pantas.</p>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 p-6 dark:border-zinc-800">
                <h2 className="text-xl font-bold">Tetapan</h2>
                <button onClick={() => setShowSettings(false)} className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-zinc-100 p-2 dark:bg-zinc-800">
                      {currentUser.theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                    </div>
                    <span>Tema Gelap</span>
                  </div>
                  <button 
                    onClick={() => setCurrentUser(prev => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }))}
                    className={cn(
                      "h-6 w-11 rounded-full transition-colors",
                      currentUser.theme === 'dark' ? "bg-emerald-500" : "bg-zinc-300"
                    )}
                  >
                    <div className={cn("h-4 w-4 rounded-full bg-white transition-transform", currentUser.theme === 'dark' ? "translate-x-6" : "translate-x-1")} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-zinc-100 p-2 dark:bg-zinc-800">
                      <Globe className="h-5 w-5" />
                    </div>
                    <span>Bahasa Terjemahan</span>
                  </div>
                  <select 
                    value={currentUser.language}
                    onChange={(e) => setCurrentUser(prev => ({ ...prev, language: e.target.value }))}
                    className="rounded-lg bg-zinc-100 px-2 py-1 text-sm dark:bg-zinc-800"
                  >
                    <option value="ms">Bahasa Melayu</option>
                    <option value="en">English</option>
                    <option value="zh">中文</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-zinc-100 p-2 dark:bg-zinc-800">
                    <Shield className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="font-medium">End-to-End Encryption</p>
                    <p className="text-xs text-zinc-500">Mesej anda dilindungi sepenuhnya.</p>
                  </div>
                </div>
              </div>
              <div className="bg-zinc-50 p-6 dark:bg-zinc-800/50">
                <button 
                  onClick={() => {
                    localStorage.removeItem('wicara_user');
                    window.location.reload();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 py-3 font-semibold text-red-600 hover:bg-red-100 dark:bg-red-900/20"
                >
                  <LogOut className="h-5 w-5" />
                  Log Keluar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nearby Users Modal */}
      <AnimatePresence>
        {showNearby && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 p-6 dark:border-zinc-800">
                <h2 className="text-xl font-bold">Pengguna Berdekatan</h2>
                <button onClick={() => setShowNearby(false)} className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {nearbyUsers.map(user => (
                  <div key={user.id} className="flex items-center justify-between rounded-2xl border border-zinc-100 p-3 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                      <img src={user.avatar} alt={user.name} className="h-12 w-12 rounded-full" />
                      <div>
                        <p className="font-semibold">{user.name}</p>
                        <p className="text-xs text-zinc-500">Berdekatan anda</p>
                      </div>
                    </div>
                    <button className="rounded-full bg-emerald-500 px-4 py-1 text-xs font-bold text-white hover:bg-emerald-600">
                      Sembang
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Call UI */}
      <AnimatePresence>
        {showCall.active && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="fixed inset-0 z-[60] flex flex-col items-center justify-between bg-zinc-900 p-12 text-white"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-emerald-500">
                <img src={activeSession?.avatar} alt="Caller" className="h-full w-full object-cover" />
              </div>
              <h2 className="text-3xl font-bold">{activeSession?.name}</h2>
              <p className="text-emerald-400 animate-pulse">Panggilan {showCall.type === 'video' ? 'Video' : 'Suara'}...</p>
            </div>

            {showCall.type === 'video' && (
              <div className="relative h-64 w-full max-w-sm overflow-hidden rounded-3xl bg-zinc-800">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Video className="h-12 w-12 text-zinc-700" />
                </div>
                <div className="absolute bottom-4 right-4 h-24 w-16 overflow-hidden rounded-xl border-2 border-white bg-zinc-700">
                  {/* Self preview */}
                </div>
              </div>
            )}

            <div className="flex gap-8">
              <button className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700">
                <Mic className="h-8 w-8" />
              </button>
              <button 
                onClick={() => setShowCall({ ...showCall, active: false })}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 hover:bg-red-600"
              >
                <Phone className="h-8 w-8 rotate-[135deg]" />
              </button>
              <button className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700">
                <Camera className="h-8 w-8" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
