"use client";

import { useState, useCallback } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DollarSign,
  FileText,
  User,
  Briefcase,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  Info,
  FileSignature,
} from "lucide-react";

type LoansSectionProps = {};

interface LoanFormData {
  loanType: string;
  loanAmount: string;
  loanPurpose: string;
  employmentStatus: string;
  monthlyIncome: string;
  employerName: string;
  employmentDuration: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;
  dateOfBirth: string;
  ssn: string;
  creditScore: string;
  existingDebts: string;
  collateral: string;
  additionalInfo: string;
}

const initialFormData: LoanFormData = {
  loanType: "",
  loanAmount: "",
  loanPurpose: "",
  employmentStatus: "",
  monthlyIncome: "",
  employerName: "",
  employmentDuration: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  country: "",
  postalCode: "",
  dateOfBirth: "",
  ssn: "",
  creditScore: "",
  existingDebts: "",
  collateral: "",
  additionalInfo: "",
};

const loanTypes = [
  { value: "personal", label: "Personal Loan" },
  { value: "business", label: "Business Loan" },
  { value: "mortgage", label: "Mortgage Loan" },
  { value: "auto", label: "Auto Loan" },
  { value: "student", label: "Student Loan" },
  { value: "home-equity", label: "Home Equity Loan" },
];

const employmentStatuses = [
  { value: "employed", label: "Employed Full-time" },
  { value: "part-time", label: "Employed Part-time" },
  { value: "self-employed", label: "Self-employed" },
  { value: "unemployed", label: "Unemployed" },
  { value: "retired", label: "Retired" },
  { value: "student", label: "Student" },
];

const countries = [
  { value: "us", label: "United States" },
  { value: "ca", label: "Canada" },
  { value: "uk", label: "United Kingdom" },
  { value: "de", label: "Germany" },
  { value: "fr", label: "France" },
  { value: "au", label: "Australia" },
  { value: "jp", label: "Japan" },
  { value: "other", label: "Other" },
];

export default function LoansSection({}: LoansSectionProps) {
  const [formData, setFormData] = useState<LoanFormData>(initialFormData);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRestrictionDialog, setShowRestrictionDialog] = useState(false);
  const [errors, setErrors] = useState<Partial<LoanFormData>>({});

  const totalSteps = 4;

  const handleInputChange = useCallback(
    (field: keyof LoanFormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      // Clear error when user starts typing
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors]
  );

  const validateStep = useCallback(
    (step: number): boolean => {
      const newErrors: Partial<LoanFormData> = {};

      switch (step) {
        case 1:
          if (!formData.loanType)
            newErrors.loanType = "Please select a loan type";
          if (!formData.loanAmount)
            newErrors.loanAmount = "Please enter loan amount";
          if (!formData.loanPurpose)
            newErrors.loanPurpose = "Please describe the loan purpose";
          break;
        case 2:
          if (!formData.employmentStatus)
            newErrors.employmentStatus = "Please select employment status";
          if (!formData.monthlyIncome)
            newErrors.monthlyIncome = "Please enter monthly income";
          if (
            formData.employmentStatus === "employed" ||
            formData.employmentStatus === "part-time"
          ) {
            if (!formData.employerName)
              newErrors.employerName = "Please enter employer name";
            if (!formData.employmentDuration)
              newErrors.employmentDuration = "Please enter employment duration";
          }
          break;
        case 3:
          if (!formData.firstName)
            newErrors.firstName = "Please enter first name";
          if (!formData.lastName) newErrors.lastName = "Please enter last name";
          if (!formData.email) newErrors.email = "Please enter email";
          if (!formData.phone) newErrors.phone = "Please enter phone number";
          if (!formData.address) newErrors.address = "Please enter address";
          if (!formData.city) newErrors.city = "Please enter city";
          if (!formData.country) newErrors.country = "Please select country";
          if (!formData.dateOfBirth)
            newErrors.dateOfBirth = "Please enter date of birth";
          break;
        case 4:
          if (!formData.ssn) newErrors.ssn = "Please enter SSN/Tax ID";
          break;
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    },
    [formData]
  );

  const handleNext = useCallback(() => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    }
  }, [currentStep, validateStep]);

  const handlePrevious = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!validateStep(currentStep)) return;

    setIsSubmitting(true);

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setIsSubmitting(false);
    setShowRestrictionDialog(true);
  }, [currentStep, validateStep]);

  const getCountryLabel = useCallback((countryCode: string) => {
    const country = countries.find((c) => c.value === countryCode);
    return country?.label || countryCode;
  }, []);

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <FileSignature className="h-12 w-12 text-[#0A7F8D] mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900">Loan Details</h3>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="loanType">Loan Type *</Label>
          <Select
            value={formData.loanType}
            onValueChange={(value) => handleInputChange("loanType", value)}
          >
            <SelectTrigger className={errors.loanType ? "border-red-500" : ""}>
              <SelectValue placeholder="Select loan type" />
            </SelectTrigger>
            <SelectContent>
              {loanTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.loanType && (
            <p className="text-red-500 text-sm mt-1">{errors.loanType}</p>
          )}
        </div>

        <div>
          <Label htmlFor="loanAmount">Loan Amount (USD) *</Label>
          <Input
            id="loanAmount"
            type="number"
            placeholder="e.g., 50000"
            value={formData.loanAmount}
            onChange={(e) => handleInputChange("loanAmount", e.target.value)}
            className={errors.loanAmount ? "border-red-500" : ""}
          />
          {errors.loanAmount && (
            <p className="text-red-500 text-sm mt-1">{errors.loanAmount}</p>
          )}
        </div>

        <div>
          <Label htmlFor="loanPurpose">Purpose of Loan *</Label>
          <Textarea
            id="loanPurpose"
            placeholder="Please describe what you plan to use this loan for..."
            value={formData.loanPurpose}
            onChange={(e) => handleInputChange("loanPurpose", e.target.value)}
            className={errors.loanPurpose ? "border-red-500" : ""}
            rows={4}
          />
          {errors.loanPurpose && (
            <p className="text-red-500 text-sm mt-1">{errors.loanPurpose}</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <Briefcase className="h-12 w-12 text-[#0A7F8D] mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900">
          Employment Information
        </h3>
        <p className="text-gray-600 mt-2">
          Help us understand your financial situation
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="employmentStatus">Employment Status *</Label>
          <Select
            value={formData.employmentStatus}
            onValueChange={(value) =>
              handleInputChange("employmentStatus", value)
            }
          >
            <SelectTrigger
              className={errors.employmentStatus ? "border-red-500" : ""}
            >
              <SelectValue placeholder="Select employment status" />
            </SelectTrigger>
            <SelectContent>
              {employmentStatuses.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.employmentStatus && (
            <p className="text-red-500 text-sm mt-1">
              {errors.employmentStatus}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="monthlyIncome">Monthly Income (USD) *</Label>
          <Input
            id="monthlyIncome"
            type="number"
            placeholder="e.g., 5000"
            value={formData.monthlyIncome}
            onChange={(e) => handleInputChange("monthlyIncome", e.target.value)}
            className={errors.monthlyIncome ? "border-red-500" : ""}
          />
          {errors.monthlyIncome && (
            <p className="text-red-500 text-sm mt-1">{errors.monthlyIncome}</p>
          )}
        </div>

        {(formData.employmentStatus === "employed" ||
          formData.employmentStatus === "part-time") && (
          <>
            <div>
              <Label htmlFor="employerName">Employer Name *</Label>
              <Input
                id="employerName"
                placeholder="Company/Organization name"
                value={formData.employerName}
                onChange={(e) =>
                  handleInputChange("employerName", e.target.value)
                }
                className={errors.employerName ? "border-red-500" : ""}
              />
              {errors.employerName && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.employerName}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="employmentDuration">Employment Duration *</Label>
              <Input
                id="employmentDuration"
                placeholder="e.g., 2 years 6 months"
                value={formData.employmentDuration}
                onChange={(e) =>
                  handleInputChange("employmentDuration", e.target.value)
                }
                className={errors.employmentDuration ? "border-red-500" : ""}
              />
              {errors.employmentDuration && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.employmentDuration}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <User className="h-12 w-12 text-[#0A7F8D] mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900">
          Personal Information
        </h3>
        <p className="text-gray-600 mt-2">
          We need your personal details for verification
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="firstName">First Name *</Label>
          <Input
            id="firstName"
            placeholder="John"
            value={formData.firstName}
            onChange={(e) => handleInputChange("firstName", e.target.value)}
            className={errors.firstName ? "border-red-500" : ""}
          />
          {errors.firstName && (
            <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>
          )}
        </div>

        <div>
          <Label htmlFor="lastName">Last Name *</Label>
          <Input
            id="lastName"
            placeholder="Doe"
            value={formData.lastName}
            onChange={(e) => handleInputChange("lastName", e.target.value)}
            className={errors.lastName ? "border-red-500" : ""}
          />
          {errors.lastName && (
            <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>
          )}
        </div>

        <div>
          <Label htmlFor="email">Email Address *</Label>
          <Input
            id="email"
            type="email"
            placeholder="john.doe@example.com"
            value={formData.email}
            onChange={(e) => handleInputChange("email", e.target.value)}
            className={errors.email ? "border-red-500" : ""}
          />
          {errors.email && (
            <p className="text-red-500 text-sm mt-1">{errors.email}</p>
          )}
        </div>

        <div>
          <Label htmlFor="phone">Phone Number *</Label>
          <Input
            id="phone"
            placeholder="+1 (555) 123-4567"
            value={formData.phone}
            onChange={(e) => handleInputChange("phone", e.target.value)}
            className={errors.phone ? "border-red-500" : ""}
          />
          {errors.phone && (
            <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
          )}
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="address">Address *</Label>
          <Input
            id="address"
            placeholder="123 Main Street, Apt 4B"
            value={formData.address}
            onChange={(e) => handleInputChange("address", e.target.value)}
            className={errors.address ? "border-red-500" : ""}
          />
          {errors.address && (
            <p className="text-red-500 text-sm mt-1">{errors.address}</p>
          )}
        </div>

        <div>
          <Label htmlFor="city">City *</Label>
          <Input
            id="city"
            placeholder="New York"
            value={formData.city}
            onChange={(e) => handleInputChange("city", e.target.value)}
            className={errors.city ? "border-red-500" : ""}
          />
          {errors.city && (
            <p className="text-red-500 text-sm mt-1">{errors.city}</p>
          )}
        </div>

        <div>
          <Label htmlFor="country">Country *</Label>
          <Select
            value={formData.country}
            onValueChange={(value) => handleInputChange("country", value)}
          >
            <SelectTrigger className={errors.country ? "border-red-500" : ""}>
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {countries.map((country) => (
                <SelectItem key={country.value} value={country.value}>
                  {country.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.country && (
            <p className="text-red-500 text-sm mt-1">{errors.country}</p>
          )}
        </div>

        <div>
          <Label htmlFor="postalCode">Postal Code</Label>
          <Input
            id="postalCode"
            placeholder="10001"
            value={formData.postalCode}
            onChange={(e) => handleInputChange("postalCode", e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="dateOfBirth">Date of Birth *</Label>
          <Input
            id="dateOfBirth"
            type="date"
            value={formData.dateOfBirth}
            onChange={(e) => handleInputChange("dateOfBirth", e.target.value)}
            className={errors.dateOfBirth ? "border-red-500" : ""}
          />
          {errors.dateOfBirth && (
            <p className="text-red-500 text-sm mt-1">{errors.dateOfBirth}</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <FileText className="h-12 w-12 text-[#0A7F8D] mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900">
          Financial Information
        </h3>
        <p className="text-gray-600 mt-2">
          Final details to complete your application
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="ssn">SSN / Tax ID *</Label>
          <Input
            id="ssn"
            placeholder="XXX-XX-XXXX"
            value={formData.ssn}
            onChange={(e) => handleInputChange("ssn", e.target.value)}
            className={errors.ssn ? "border-red-500" : ""}
          />
          {errors.ssn && (
            <p className="text-red-500 text-sm mt-1">{errors.ssn}</p>
          )}
        </div>

        <div>
          <Label htmlFor="creditScore">Credit Score (if known)</Label>
          <Input
            id="creditScore"
            type="number"
            placeholder="e.g., 750"
            value={formData.creditScore}
            onChange={(e) => handleInputChange("creditScore", e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="existingDebts">Existing Debts (USD)</Label>
          <Input
            id="existingDebts"
            type="number"
            placeholder="Total amount of existing debts"
            value={formData.existingDebts}
            onChange={(e) => handleInputChange("existingDebts", e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="collateral">Collateral (if any)</Label>
          <Textarea
            id="collateral"
            placeholder="Describe any assets you can offer as collateral..."
            value={formData.collateral}
            onChange={(e) => handleInputChange("collateral", e.target.value)}
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="additionalInfo">Additional Information</Label>
          <Textarea
            id="additionalInfo"
            placeholder="Any additional information that might help with your application..."
            value={formData.additionalInfo}
            onChange={(e) =>
              handleInputChange("additionalInfo", e.target.value)
            }
            rows={3}
          />
        </div>
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      default:
        return renderStep1();
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 bg-gray-50 overflow-auto pt-xs-16">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 leading-tight">
            Loan Application
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Apply for a loan with Lithuanian Crypto Central Bank - Fast, secure,
            and reliable
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-4">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium ${
                    step <= currentStep
                      ? "bg-[#0A7F8D] text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {step < currentStep ? (
                    <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                  ) : (
                    step
                  )}
                </div>
                {step < totalSteps && (
                  <div
                    className={`w-8 sm:w-16 h-1 mx-1 sm:mx-2 ${
                      step < currentStep ? "bg-[#0A7F8D]" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="text-center">
            <span className="text-xs sm:text-sm text-gray-600">
              Step {currentStep} of {totalSteps}
            </span>
          </div>
        </div>

        {/* Form Card */}
        <Card className="shadow-lg border-0">
          <CardHeader className="bg-[#F5F0F0] border-b p-6">
            <CardTitle className="flex items-center text-lg">
              Lithuanian Crypto Central Bank Loan Application
              <Badge className="ml-2 bg-[#0A7F8D] text-white">Secure</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {renderStepContent()}

            {/* Navigation Buttons */}
            <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-0 mt-8 pt-6 border-t">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 1}
                className="bg-transparent order-2 sm:order-1"
              >
                Previous
              </Button>

              {currentStep < totalSteps ? (
                <Button
                  onClick={handleNext}
                  className="bg-[#0A7F8D] hover:bg-[#0A7F8D]/90 text-white order-1 sm:order-2"
                >
                  Next Step
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="bg-[#0A7F8D] hover:bg-[#0A7F8D]/90 text-white order-1 sm:order-2"
                >
                  {isSubmitting ? "Processing..." : "Submit Application"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Information Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-6 sm:mt-8">
          <Card>
            <CardContent className="p-4 sm:p-6 text-center">
              <CheckCircle className="h-10 w-10 sm:h-12 sm:w-12 text-[#0A7F8D] mx-auto mb-3 sm:mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">
                Quick Approval
              </h3>
              <p className="text-sm text-gray-600">
                Get approved in as little as 24 hours with our streamlined
                process
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6 text-center">
              <CreditCard className="h-10 w-10 sm:h-12 sm:w-12 text-[#0A7F8D] mx-auto mb-3 sm:mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">
                Competitive Rates
              </h3>
              <p className="text-sm text-gray-600">
                Enjoy competitive interest rates starting from 3.99% APR
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6 text-center">
              <Info className="h-10 w-10 sm:h-12 sm:w-12 text-[#0A7F8D] mx-auto mb-3 sm:mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">
                No Hidden Fees
              </h3>
              <p className="text-sm text-gray-600">
                Transparent pricing with no hidden fees or prepayment penalties
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Country Restriction Dialog */}
        <Dialog
          open={showRestrictionDialog}
          onOpenChange={setShowRestrictionDialog}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <DialogTitle className="text-center text-xl font-semibold text-gray-900">
                Application Not Available
              </DialogTitle>
              <DialogDescription className="text-center text-gray-600 mt-4">
                Thank you for your application. Based on the information
                provided, we’re unable to proceed, as our lending products are
                currently available only to citizens or permanent residents of
                Panama.
                <br />
                <br />
                This restriction is required under our regulatory obligations.
                If your residency status changes, you’re welcome to reapply. For
                assistance, please contact our support team.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-6">
              <Alert className="border-amber-200 bg-amber-50">
                <Info className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  Ineligible due to residency. We can’t proceed with this loan
                  application.
                </AlertDescription>
              </Alert>
            </div>
            <div className="flex justify-center mt-6">
              <Button
                onClick={() => setShowRestrictionDialog(false)}
                className="bg-[#0A7F8D] hover:bg-[#0A7F8D]/90 text-white"
              >
                I Understand
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
