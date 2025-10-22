"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, AlertTriangle, Info, CheckCircle } from "lucide-react";

export default function MessageSection() {
  const messages = [
    {
      id: 1,
      type: "alert",
      title: "Unpaid Taxes Alert",
      content:
        "Your account has been temporarily frozen due to unpaid taxes. To restore full access, please settle the required tax amount in the 'Payments' section.",
      action: "Go to: Payments > Tax Settlement",
      footer:
        "For your security, access will remain restricted until payment is completed.",
      date: "2024-01-15",
      status: "unread",
    },
    {
      id: 2,
      type: "info",
      title: "New Card Available",
      content:
        "Your new virtual card has been created and is ready to use. You can view your card details in the Cards section.",
      action: "Go to: Cards > View Details",
      date: "2024-01-14",
      status: "read",
    },
    {
      id: 3,
      type: "success",
      title: "Transfer Completed",
      content:
        "Your currency transfer from EUR to USD has been completed successfully. The funds are now available in your USD account.",
      date: "2024-01-13",
      status: "read",
    },
  ];

  const getMessageIcon = (type: string) => {
    switch (type) {
      case "alert":
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case "info":
        return <Info className="w-5 h-5 text-blue-500" />;
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
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
      default:
        return "border-l-gray-500";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Messages</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            {messages.filter((m) => m.status === "unread").length} unread
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {messages.map((message) => (
          <Card
            key={message.id}
            className={`border-l-4 ${getMessageBorderColor(message.type)}`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {getMessageIcon(message.type)}
                  <div>
                    <CardTitle className="text-lg">{message.title}</CardTitle>
                    <p className="text-sm text-gray-500">
                      {new Date(message.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {message.status === "unread" && (
                  <div className="w-2 h-2 bg-[#F26623] rounded-full"></div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-gray-700">{message.content}</p>
              {message.action && (
                <p className="text-sm font-medium text-[#F26623]">
                  {message.action}
                </p>
              )}
              {message.footer && (
                <p className="text-sm text-gray-600 italic">{message.footer}</p>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm">
                  Mark as Read
                </Button>
                {message.type === "alert" && (
                  <Button size="sm" className="bg-[#F26623] hover:bg-[#E55A1F]">
                    Take Action
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full justify-start">
            <Mail className="w-4 h-4 mr-2" />
            Contact Support
          </Button>
          <Button variant="outline" className="w-full justify-start">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Report Issue
          </Button>
          <Button variant="outline" className="w-full justify-start">
            <Info className="w-4 h-4 mr-2" />
            Account Information
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
