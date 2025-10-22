"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Mail,
  AlertTriangle,
  Info,
  CheckCircle,
  RefreshCw,
} from "lucide-react";

export default function MessageSection() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from("user_messages")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setMessages(data || []);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from("user_messages")
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq("id", messageId);

      if (error) throw error;
      fetchMessages();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case "alert":
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case "info":
        return <Info className="w-5 h-5 text-blue-500" />;
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Mail className="w-5 h-5 text-gray-500" />;
    }
  };

  const getMessageBorderColor = (type: string) => {
    switch (type) {
      case "alert":
        return "border-l-red-500";
      case "info":
        return "border-l-blue-500";
      case "success":
        return "border-l-green-500";
      case "warning":
        return "border-l-yellow-500";
      default:
        return "border-l-gray-500";
    }
  };

  if (loading) {
    return <div className="p-6">Loading messages...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Messages</h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {messages.filter((m) => !m.is_read).length} unread
          </span>
          <Button variant="outline" size="sm" onClick={fetchMessages}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {messages.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <Mail className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">No messages yet</p>
            </CardContent>
          </Card>
        ) : (
          messages.map((message) => (
            <Card
              key={message.id}
              className={`border-l-4 ${getMessageBorderColor(
                message.message_type
              )}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {getMessageIcon(message.message_type)}
                    <div>
                      <CardTitle className="text-lg">{message.title}</CardTitle>
                      <p className="text-sm text-gray-500">
                        {new Date(message.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {!message.is_read && (
                    <div className="w-2 h-2 bg-[#F26623] rounded-full"></div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-gray-700">{message.content}</p>
                <div className="flex gap-2 pt-2">
                  {!message.is_read && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markAsRead(message.id)}
                    >
                      Mark as Read
                    </Button>
                  )}
                  {message.message_type === "alert" && (
                    <Button
                      size="sm"
                      className="bg-[#F26623] hover:bg-[#E55A1F]"
                    >
                      Take Action
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start bg-transparent"
          >
            <Mail className="w-4 h-4 mr-2" />
            Contact Support
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start bg-transparent"
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Report Issue
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start bg-transparent"
          >
            <Info className="w-4 h-4 mr-2" />
            Account Information
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
