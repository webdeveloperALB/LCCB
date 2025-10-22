"use client";

import { useState, useEffect } from "react";

import { supabase } from "@/lib/supabase";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  CreditCard,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  Settings,
} from "lucide-react";

export default function CardSection() {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCardForm, setShowCardForm] = useState(false);
  const [showCardDetails, setShowCardDetails] = useState<{
    [key: string]: boolean;
  }>({});
  const [showCardSettings, setShowCardSettings] = useState<{
    [key: string]: boolean;
  }>({});
  const [formData, setFormData] = useState({
    card_type: "Virtual",
    spending_limit: "5000",
    daily_limit: "1000",
    international_enabled: false,
    delivery_address: "",
    card_design: "orange-gradient",
  });

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from("cards")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        setCards(data || []);
      }
    } catch (error) {
      console.error("Error fetching cards:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateCardNumber = () => {
    return (
      "4532" +
      Math.floor(Math.random() * 1000000000000)
        .toString()
        .padStart(12, "0")
    );
  };

  const generateCVV = () => {
    return Math.floor(Math.random() * 900 + 100).toString();
  };

  const generatePIN = () => {
    return Math.floor(Math.random() * 9000 + 1000).toString();
  };

  const generateAccountNumber = () => {
    return (
      "****" +
      Math.floor(Math.random() * 100000000)
        .toString()
        .padStart(8, "0")
    );
  };

  const createCard = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();

        const cardData = {
          user_id: user.id,
          card_number: generateCardNumber(),
          card_holder_name: profile?.full_name?.toUpperCase() || "CARD HOLDER",
          expiry_month: 12,
          expiry_year: new Date().getFullYear() + 3,
          cvv: generateCVV(),
          pin: generatePIN(),
          account_number: generateAccountNumber(),
          card_type: formData.card_type,
          card_design: formData.card_design,
          spending_limit: Number.parseFloat(formData.spending_limit),
          daily_limit: Number.parseFloat(formData.daily_limit),
          international_enabled: formData.international_enabled,
          delivery_address:
            formData.card_type === "Physical"
              ? formData.delivery_address
              : null,
          expected_delivery:
            formData.card_type === "Physical"
              ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
              : null,
          status: "Pending",
          is_activated: false,
        };

        const { error } = await supabase.from("cards").insert(cardData);

        if (error) throw error;

        setFormData({
          card_type: "Virtual",
          spending_limit: "5000",
          daily_limit: "1000",
          international_enabled: false,
          delivery_address: "",
          card_design: "orange-gradient",
        });
        setShowCardForm(false);
        fetchCards();
        alert("New card request submitted! Your card is pending approval.");
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const toggleCardStatus = async (cardId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "Active" ? "Frozen" : "Active";
      const updateData: any = { status: newStatus };

      if (
        newStatus === "Active" &&
        !cards.find((c) => c.id === cardId)?.is_activated
      ) {
        updateData.is_activated = true;
        updateData.activated_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("cards")
        .update(updateData)
        .eq("id", cardId);

      if (error) throw error;

      fetchCards();
      alert(`Card ${newStatus.toLowerCase()} successfully!`);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const toggleCardDetails = (cardId: string) => {
    setShowCardDetails((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  };

  const toggleCardSettings = (cardId: string) => {
    setShowCardSettings((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  };

  const formatCardNumber = (cardNumber: string, show: boolean) => {
    if (show) {
      return cardNumber.replace(/(.{4})/g, "$1 ").trim();
    }
    return "**** **** **** " + cardNumber.slice(-4);
  };

  const getCardColor = (cardDesign: string) => {
    switch (cardDesign?.toLowerCase()) {
      case "orange-gradient":
        return "from-[#F26623] to-[#E55A1F]";
      case "blue-gradient":
        return "from-blue-500 to-blue-700";
      case "red-gradient":
        return "from-red-500 to-orange-500";
      case "green-gradient":
        return "from-green-500 to-teal-600";
      case "purple-gradient":
        return "from-purple-500 to-purple-700";
      case "pink-gradient":
        return "from-pink-500 to-rose-500";
      case "black-gradient":
        return "from-gray-800 to-black";
      case "gold-gradient":
        return "from-yellow-400 to-yellow-600";
      default:
        return "from-[#F26623] to-[#E55A1F]";
    }
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">Loading cards...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-6 max-w-4xl min-h-full">
        <div className="flex flex-row items-center justify-between">
          <h2 className="text-2xl font-bold">My Cards</h2>
          <Button
            onClick={() => setShowCardForm(true)}
            className="bg-[#F26623] hover:bg-[#E55A1F]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Request New Card
          </Button>
        </div>

        {showCardForm && (
          <Card>
            <CardHeader>
              <CardTitle>Request New Card</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Card Type</Label>
                  <Select
                    value={formData.card_type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, card_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Virtual">Virtual Card</SelectItem>
                      <SelectItem value="Physical">Physical Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Card Design</Label>
                  <Select
                    value={formData.card_design}
                    onValueChange={(value) =>
                      setFormData({ ...formData, card_design: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="orange-gradient">
                        Orange Gradient
                      </SelectItem>
                      <SelectItem value="blue-gradient">
                        Blue Gradient
                      </SelectItem>
                      <SelectItem value="red-gradient">Red Gradient</SelectItem>
                      <SelectItem value="green-gradient">
                        Green Gradient
                      </SelectItem>
                      <SelectItem value="purple-gradient">
                        Purple Gradient
                      </SelectItem>
                      <SelectItem value="pink-gradient">
                        Pink Gradient
                      </SelectItem>
                      <SelectItem value="black-gradient">
                        Black Gradient
                      </SelectItem>
                      <SelectItem value="gold-gradient">
                        Gold Gradient
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Spending Limit</Label>
                  <Input
                    type="number"
                    step="100"
                    value={formData.spending_limit}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        spending_limit: e.target.value,
                      })
                    }
                    placeholder="5000"
                  />
                </div>
                <div>
                  <Label>Daily Limit</Label>
                  <Input
                    type="number"
                    step="50"
                    value={formData.daily_limit}
                    onChange={(e) =>
                      setFormData({ ...formData, daily_limit: e.target.value })
                    }
                    placeholder="1000"
                  />
                </div>
                <div className="flex items-center space-x-2 md:col-span-2">
                  <input
                    type="checkbox"
                    id="international"
                    checked={formData.international_enabled}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        international_enabled: e.target.checked,
                      })
                    }
                    aria-label="Enable International Usage"
                    title="Enable International Usage"
                  />
                  <Label htmlFor="international">
                    Enable International Usage
                  </Label>
                </div>
              </div>

              {formData.card_type === "Physical" && (
                <div>
                  <Label>Delivery Address</Label>
                  <Input
                    value={formData.delivery_address}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        delivery_address: e.target.value,
                      })
                    }
                    placeholder="Enter your delivery address"
                    required
                  />
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={createCard}
                  className="bg-[#F26623] hover:bg-[#E55A1F]"
                  disabled={
                    formData.card_type === "Physical" &&
                    !formData.delivery_address
                  }
                >
                  Create Card
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCardForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cards Display */}
        <div className="space-y-6 pb-6">
          {cards.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <CreditCard className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500">
                  No cards found. Request your first card!
                </p>
              </CardContent>
            </Card>
          ) : (
            cards.map((card) => (
              <div key={card.id} className="space-y-4">
                {/* Card Visual */}
                <div className="flex ">
                  <div
                    className={`w-full max-w-sm bg-gradient-to-r ${getCardColor(
                      card.card_design
                    )} rounded-xl p-6 text-white shadow-lg pointer-events-none`}
                  >
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <p className="text-sm opacity-80">
                          {card.issuer || "Digital Chain Bank"}
                        </p>
                        <p className="text-xs opacity-60">
                          {card.card_type} • {card.network || "Visa"}
                        </p>
                      </div>
                      <div className="w-8 h-8 bg-white rounded-full opacity-80"></div>
                    </div>

                    <div className="mb-6">
                      <p className="text-lg font-mono tracking-wider break-all">
                        {formatCardNumber(
                          card.card_number,
                          showCardDetails[card.id]
                        )}
                      </p>
                    </div>

                    <div className="flex justify-between items-end">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs opacity-60">CARD HOLDER</p>
                        <p className="text-sm font-medium truncate">
                          {card.card_holder_name}
                        </p>
                      </div>
                      <div className="ml-4">
                        <p className="text-xs opacity-60">EXPIRES</p>
                        <p className="text-sm font-medium">
                          {card.expiry_month.toString().padStart(2, "0")}/
                          {card.expiry_year.toString().slice(-2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Controls */}
                <Card className="relative">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{card.card_type} Card</p>
                        <p className="text-sm text-gray-600 break-words">
                          Spending: $
                          {Number(card.spending_limit).toLocaleString()} •
                          Daily: ${Number(card.daily_limit).toLocaleString()}
                        </p>
                        <p
                          className={`text-sm font-medium ${
                            card.status === "Active"
                              ? "text-green-600"
                              : card.status === "Pending"
                              ? "text-yellow-600"
                              : "text-red-600"
                          }`}
                        >
                          Status: {card.status}{" "}
                          {card.is_activated
                            ? "• Activated"
                            : "• Not Activated"}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => toggleCardDetails(card.id)}
                        >
                          {showCardDetails[card.id] ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => toggleCardSettings(card.id)}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => toggleCardStatus(card.id, card.status)}
                          disabled={card.status === "Pending"}
                          className={
                            card.status === "Pending"
                              ? "text-gray-400 cursor-not-allowed"
                              : card.status === "Active"
                              ? "text-red-600"
                              : "text-green-600"
                          }
                        >
                          {card.status === "Active" ? (
                            <Lock className="w-4 h-4" />
                          ) : card.status === "Pending" ? (
                            <Lock className="w-4 h-4" />
                          ) : (
                            <Unlock className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {showCardDetails[card.id] && (
                      <div className="border-t pt-4 space-y-2">
                        <p className="text-sm break-all">
                          <span className="font-medium">Full Number:</span>{" "}
                          {card.card_number}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">CVV:</span> {card.cvv}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">PIN:</span> {card.pin}
                        </p>
                        <p className="text-sm break-all">
                          <span className="font-medium">Account Number:</span>{" "}
                          {card.account_number}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Routing Number:</span>{" "}
                          {card.routing_number}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Created:</span>{" "}
                          {new Date(card.created_at).toLocaleDateString()}
                        </p>
                        {card.activated_at && (
                          <p className="text-sm">
                            <span className="font-medium">Activated:</span>{" "}
                            {new Date(card.activated_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    )}

                    {showCardSettings[card.id] && (
                      <div className="border-t pt-4 space-y-2">
                        <p className="text-sm font-medium mb-2">
                          Card Settings:
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Design:</span>{" "}
                          {card.card_design}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">International:</span>{" "}
                          {card.international_enabled ? "Enabled" : "Disabled"}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Contactless:</span>{" "}
                          {card.contactless_enabled ? "Enabled" : "Disabled"}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Online Payments:</span>{" "}
                          {card.online_enabled ? "Enabled" : "Disabled"}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">ATM Limit:</span> $
                          {Number(card.atm_limit).toLocaleString()}
                        </p>
                        {card.delivery_address && (
                          <p className="text-sm break-words">
                            <span className="font-medium">
                              Delivery Address:
                            </span>{" "}
                            {card.delivery_address}
                          </p>
                        )}
                        {card.expected_delivery && (
                          <p className="text-sm">
                            <span className="font-medium">
                              Expected Delivery:
                            </span>{" "}
                            {new Date(
                              card.expected_delivery
                            ).toLocaleDateString()}
                          </p>
                        )}
                        {card.last_used_at && (
                          <p className="text-sm">
                            <span className="font-medium">Last Used:</span>{" "}
                            {new Date(card.last_used_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
