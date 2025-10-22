"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Phone,
  Mail,
  MessageCircle,
  HelpCircle,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Send,
} from "lucide-react";
import LiveChatClient from "./live-chat-client";

interface UserProfile {
  id: string;
  client_id: string;
  full_name: string;
  email: string;
  created_at?: string;
  updated_at?: string;
}

interface SupportSectionProps {
  userProfile: UserProfile;
}

export default function SupportSection({ userProfile }: SupportSectionProps) {
  const { toast } = useToast();
  const [ticketForm, setTicketForm] = useState({
    subject: "",
    category: "",
    priority: "",
    description: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    // Check for existing chat session when component mounts
    const savedSession = localStorage.getItem("chat_session");
    if (savedSession) {
      setChatOpen(true);
    }
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!ticketForm.subject.trim()) {
      newErrors.subject = "Subject is required";
    }
    if (!ticketForm.category) {
      newErrors.category = "Please select a category";
    }
    if (!ticketForm.priority) {
      newErrors.priority = "Please select a priority";
    }
    if (!ticketForm.description.trim()) {
      newErrors.description = "Description is required";
    } else if (ticketForm.description.trim().length < 10) {
      newErrors.description = "Description must be at least 10 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submitTicket = async () => {
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields correctly.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast({
        title: "Ticket Submitted Successfully!",
        description:
          "We'll get back to you within 24 hours. Ticket ID: #" +
          Math.random().toString(36).substr(2, 9).toUpperCase(),
      });

      // Reset form
      setTicketForm({
        subject: "",
        category: "",
        priority: "",
        description: "",
      });
      setErrors({});
    } catch (error) {
      toast({
        title: "Submission Failed",
        description:
          "There was an error submitting your ticket. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const faqItems = [
    {
      question: "How do I transfer money between currencies?",
      answer:
        "Go to the Transfers section, select your source and destination currencies, enter the amount, and click Execute Transfer.",
    },
    {
      question: "How long do deposits take to process?",
      answer:
        "Bank transfers typically take 1-3 business days, while card deposits are usually instant.",
    },
    {
      question: "Can I freeze my card if it's lost?",
      answer:
        "Yes, go to the Cards section and click the lock icon next to your card to freeze it immediately.",
    },
    {
      question: "How do I update my account information?",
      answer:
        "You can update your profile information in the Accounts section under Personal Details.",
    },
  ];

  const systemStatus = [
    { service: "Banking Services", status: "operational" },
    { service: "Card Payments", status: "operational" },
    { service: "Cryptocurrency Trading", status: "maintenance" },
    { service: "Mobile App", status: "operational" },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "operational":
        return <CheckCircle className="w-4 h-4 mr-1 text-green-600" />;
      case "maintenance":
        return <Clock className="w-4 h-4 mr-1 text-yellow-600" />;
      case "down":
        return <AlertCircle className="w-4 h-4 mr-1 text-red-600" />;
      default:
        return <CheckCircle className="w-4 h-4 mr-1 text-green-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "operational":
        return "text-green-600";
      case "maintenance":
        return "text-yellow-600";
      case "down":
        return "text-red-600";
      default:
        return "text-green-600";
    }
  };

  const startLiveChat = () => {
    setChatOpen(true);
    toast({
      title: "Live Chat",
      description: "Opening chat window...",
    });
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-hide">
      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div className="p-6 pt-4 pt-xs-16 space-y-6 max-w-7xl mx-auto">
        <div>
          <h2 className="text-2xl font-bold">Support Center</h2>
          <p className="text-gray-600 mt-1">Get help when you need it</p>
        </div>

        {/* Contact Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="text-center hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <Phone className="w-8 h-8 mx-auto mb-3 text-[#0A7F8D]" />
              <h3 className="font-medium mb-2">Phone Support</h3>
              <p className="text-sm text-gray-600 mb-3">Available 24/7</p>
              <p className="font-mono text-sm">+1 (555) 123-4567</p>
              <a href="tel:15551234567" aria-label="Call support">
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 bg-transparent cursor-pointer"
                >
                  Call Now
                </Button>
              </a>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <Mail className="w-8 h-8 mx-auto mb-3 text-[#0A7F8D]" />
              <h3 className="font-medium mb-2">Email Support</h3>
              <p className="text-sm text-gray-600 mb-3">Response within 24h</p>
              <p className="text-sm">support@digitalchainbank.com</p>
              <a
                href="mailto:support@digitalchainbank.com"
                aria-label="Send an email"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 bg-transparent cursor-pointer"
                >
                  Send Email
                </Button>
              </a>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <MessageCircle className="w-8 h-8 mx-auto mb-3 text-[#0A7F8D]" />
              <h3 className="font-medium mb-2">Live Chat</h3>
              <p className="text-sm text-gray-600 mb-3">Mon-Fri 9AM-6PM</p>
              <Button
                size="sm"
                className="bg-[#0A7F8D] hover:bg-[#0A7F8D]/90 mt-3"
                onClick={() => startLiveChat()}
              >
                Start Chat
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* FAQ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <HelpCircle className="w-5 h-5 mr-2" />
              Frequently Asked Questions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {faqItems.map((item, index) => (
              <div key={index} className="border-b pb-4 last:border-b-0">
                <h4 className="font-medium mb-2 text-gray-900">
                  {item.question}
                </h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {item.answer}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <LiveChatClient isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
