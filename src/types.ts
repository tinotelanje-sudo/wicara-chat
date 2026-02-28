export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  status?: string;
  lastSeen?: string;
  latitude?: number;
  longitude?: number;
  theme?: 'light' | 'dark';
  language?: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId?: string;
  groupId?: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'sticker';
  timestamp: string;
  isRead: boolean;
}

export interface ChatSession {
  id: string;
  name: string;
  avatar: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  isGroup: boolean;
  type: 'individual' | 'group' | 'ai';
}

export interface Story {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  type: 'text' | 'image' | 'video';
  createdAt: string;
}
