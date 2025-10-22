"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageCircle, Send, X, Minimize2, Maximize2, User, Wifi, WifiOff } from 'lucide-react';
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  id: string;
  session_id: string;
  sender_type: "client" | "admin";
  sender_name: string | null;
  message: string;
  created_at: string;
  read_by_admin: boolean;
  read_by_client: boolean;
}

interface LiveChatClientProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LiveChatClient({
  isOpen,
  onClose,
}: LiveChatClientProps) {
  const { toast } = useToast();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [isStarted, setIsStarted] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const messagesPaneRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageCountRef = useRef(0);

  const forceScrollToBottom = () => {
    const el = messagesPaneRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  useEffect(() => {
    const savedSession = localStorage.getItem("chat_session");
    if (savedSession && isOpen) {
      try {
        const sessionData = JSON.parse(savedSession);
        setSessionId(sessionData.sessionId);
        setClientName(sessionData.clientName);
        setClientEmail(sessionData.clientEmail || "");
        setIsStarted(true);
      } catch {
        localStorage.removeItem("chat_session");
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !isMinimized && isStarted && messages.length > 0) {
      forceScrollToBottom();
    }
  }, [isOpen, isMinimized, isStarted, messages.length]);

  const startChat = async () => {
    if (!clientName.trim() || !clientEmail.trim()) {
      toast({
        title: "Missing Info",
        description: "Please enter both name and email to start.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .insert({
          client_name: clientName.trim(),
          client_email: clientEmail.trim(),
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;

      setSessionId(data.id);
      setIsStarted(true);

      localStorage.setItem(
        "chat_session",
        JSON.stringify({
          sessionId: data.id,
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim(),
        })
      );

      const welcome = {
        session_id: data.id,
        sender_type: "client" as const,
        sender_name: clientName.trim(),
        message: `Hi, I'm ${clientName.trim()}. I need help with my account.`,
        read_by_admin: false,
        read_by_client: true,
      };

      const { data: msg } = await supabase
        .from("chat_messages")
        .insert(welcome)
        .select()
        .single();

      setMessages([msg]);
      lastMessageCountRef.current = 1;

      toast({
        title: "Chat Started",
        description: "You're now connected to support.",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to start chat.",
        variant: "destructive",
      });
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !sessionId) return;
    const text = newMessage.trim();
    setNewMessage("");

    try {
      const messageData = {
        session_id: sessionId,
        sender_type: "client" as const,
        sender_name: clientName,
        message: text,
        read_by_admin: false,
        read_by_client: true,
      };

      const { data } = await supabase
        .from("chat_messages")
        .insert(messageData)
        .select()
        .single();

      setMessages((prev) => [...prev, data]);
      lastMessageCountRef.current++;
      forceScrollToBottom();

      await supabase
        .from("chat_sessions")
        .update({
          updated_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
    } catch {
      setNewMessage(text);
      toast({
        title: "Error",
        description: "Failed to send message.",
        variant: "destructive",
      });
    }
  };

  const fetchMessages = async () => {
    if (!sessionId) return;
    try {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (!data) return;

      if (data.length !== lastMessageCountRef.current) {
        setMessages(data);
        lastMessageCountRef.current = data.length;
        forceScrollToBottom();
      }
    } catch {
      setIsConnected(false);
    }
  };

  useEffect(() => {
    if (!sessionId || !isStarted) return;
    fetchMessages();
    pollingIntervalRef.current = setInterval(fetchMessages, 2000);
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [sessionId, isStarted]);

  const endChatSession = () => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    localStorage.removeItem("chat_session");
    setSessionId(null);
    setMessages([]);
    setNewMessage("");
    setClientName("");
    setClientEmail("");
    setIsStarted(false);
    setIsMinimized(false);
    setIsConnected(false);
    lastMessageCountRef.current = 0;
    onClose();
  };

  const handleMinimize = () => setIsMinimized(true);
  const handleMaximize = () => {
    setIsMinimized(false);
    setTimeout(forceScrollToBottom, 100);
  };

  const formatTime = (t: string) =>
    new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (isMinimized) {
    return (
      <div className="fixed bottom-2 right-4 w-72 z-50 bg-white border rounded-lg shadow-md">
        <div className="p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center text-xs font-medium">
              <MessageCircle className="w-3.5 h-3.5 mr-1.5 text-[#0A7F8D]" />
              Live Chat
            </div>
            <div className="flex items-center space-x-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={handleMaximize}
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={endChatSession}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md h-[600px] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center text-base">
              <MessageCircle className="w-5 h-5 mr-2 text-[#0A7F8D]" />
              Live Chat Support
            </DialogTitle>
            <div className="flex items-center space-x-1">
              <Button variant="ghost" size="sm" onClick={handleMinimize}>
                <Minimize2 className="w-4 h-4 mr-10 mb-4" />
              </Button>
            </div>
          </div>
          <DialogDescription className="text-sm">
            {isStarted ? (
              <span className="flex items-center">
                You're connected to our support team
              </span>
            ) : (
              "Get instant help from our support team"
            )}
          </DialogDescription>
        </DialogHeader>

        {/* <CHANGE> Fixed the layout structure to prevent input blocking */}
        <div className="flex flex-col flex-1 min-h-0 px-4 pb-4">
          {!isStarted ? (
            <div className="space-y-4">
              <div>
                <Label>Your Name *</Label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Enter your name"
                />
              </div>
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="Enter your email"
                />
              </div>
              <Button
                onClick={startChat}
                className="w-full bg-[#0A7F8D] hover:bg-[#0A7F8D]/90"
                disabled={!clientName.trim() || !clientEmail.trim()}
              >
                Start Chat
              </Button>
            </div>
          ) : (
            <>
              <div className="p-2 border-b bg-gray-50 flex justify-between items-center text-xs font-medium flex-shrink-0">
                Chat with Support
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={endChatSession}
                  className="text-xs h-6 px-2 text-red-600 hover:text-red-700"
                >
                  End Chat
                </Button>
              </div>

              <div
                ref={messagesPaneRef}
                className="flex-1 overflow-y-auto mb-3 border rounded-lg p-3 bg-gray-50 scroll-smooth"
              >
                <div className="space-y-4">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${
                        m.sender_type === "client"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[75%] p-3 rounded-lg text-sm shadow-sm ${
                          m.sender_type === "client"
                            ? "bg-[#0A7F8D] text-white rounded-br-sm"
                            : "bg-white text-gray-800 border rounded-bl-sm"
                        }`}
                      >
                        <div className="flex items-center mb-1">
                          <User className="w-3 h-3 mr-1 opacity-70" />
                          <span className="text-xs font-medium opacity-90">
                            {m.sender_type === "client"
                              ? "You"
                              : "Support Agent"}
                          </span>
                        </div>
                        <div className="leading-relaxed break-words">
                          {m.message}
                        </div>
                        <div
                          className={`text-xs mt-2 ${
                            m.sender_type === "client"
                              ? "text-orange-100"
                              : "text-gray-500"
                          }`}
                        >
                          {formatTime(m.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex space-x-2 flex-shrink-0">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="bg-[#0A7F8D] hover:bg-[#0A7F8D]/90 px-3"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}