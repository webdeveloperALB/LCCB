"use client";
import type React from "react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  Upload,
  CheckCircle,
  X,
  Clock,
  XCircle,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface KYCVerificationProps {
  userId: string;
  onKYCComplete: () => void;
}

interface UploadedFile {
  file: File;
  preview: string;
  uploaded: boolean;
}

type KYCStatus = "not_started" | "pending" | "approved" | "rejected";

export default function KYCVerification({
  userId,
  onKYCComplete,
}: KYCVerificationProps) {
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [kycStatus, setKycStatus] = useState<KYCStatus>("not_started");

  const [documents, setDocuments] = useState({
    idDocument: null as UploadedFile | null,
    driverLicense: null as UploadedFile | null,
    utilityBill: null as UploadedFile | null,
    selfie: null as UploadedFile | null,
  });

  const [formData, setFormData] = useState({
    documentType: "passport", // passport, id_card
    documentNumber: "",
    fullName: "",
    dateOfBirth: "",
    address: "",
    city: "",
    country: "",
    postalCode: "",
  });

  // Check user's KYC status on component mount
  useEffect(() => {
    checkKYCStatus();
  }, [userId]);

  const checkKYCStatus = async () => {
    try {
      setCheckingStatus(true);
      const { data, error } = await supabase
        .from("users")
        .select("kyc_status")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error checking KYC status:", error);
        setError("Failed to check KYC status");
        return;
      }

      if (data) {
        setKycStatus(data.kyc_status as KYCStatus);

        // If KYC is already approved, immediately proceed
        if (data.kyc_status === "approved") {
          onKYCComplete();
        }
      }
    } catch (error) {
      console.error("Error in checkKYCStatus:", error);
      setError("Failed to verify KYC status");
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleFileUpload = (type: keyof typeof documents, file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      // 10MB limit
      setError("File size must be less than 10MB");
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "application/pdf",
    ];
    if (!allowedTypes.includes(file.type)) {
      setError("Only JPEG, PNG, and PDF files are allowed");
      return;
    }

    const preview = file.type.startsWith("image/")
      ? URL.createObjectURL(file)
      : "/pdf-icon.png";

    setDocuments((prev) => ({
      ...prev,
      [type]: {
        file,
        preview,
        uploaded: false,
      },
    }));
    setError(null);
  };

  const uploadFileToSupabase = async (file: File, path: string) => {
    try {
      console.log(`Uploading file to path: ${path}`);

      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${fileExt}`;
      const filePath = `${path}/${fileName}`;

      console.log(`Full file path: ${filePath}`);

      const { data, error } = await supabase.storage
        .from("kyc-documents")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        console.error("Storage upload error:", error);
        throw new Error(`File upload failed: ${error.message}`);
      }

      console.log("File uploaded successfully:", data);
      return filePath;
    } catch (error) {
      console.error("Error in uploadFileToSupabase:", error);
      throw error;
    }
  };

  const handleSubmitKYC = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      console.log("Starting KYC submission...");

      // Validate required documents
      if (
        !documents.idDocument ||
        !documents.utilityBill ||
        !documents.selfie
      ) {
        throw new Error("Please upload all required documents");
      }

      console.log("Required documents validated");

      // Upload files to Supabase Storage directly (skip bucket check)
      console.log("Starting file uploads...");
      const uploadPromises = [];
      const documentPaths: any = {};

      if (documents.idDocument) {
        console.log("Uploading ID document...");
        uploadPromises.push(
          uploadFileToSupabase(
            documents.idDocument.file,
            `${userId}/id-documents`
          ).then((path) => {
            documentPaths.id_document_path = path;
            console.log("ID document uploaded:", path);
          })
        );
      }

      if (documents.driverLicense) {
        console.log("Uploading driver license...");
        uploadPromises.push(
          uploadFileToSupabase(
            documents.driverLicense.file,
            `${userId}/driver-license`
          ).then((path) => {
            documentPaths.driver_license_path = path;
            console.log("Driver license uploaded:", path);
          })
        );
      }

      if (documents.utilityBill) {
        console.log("Uploading utility bill...");
        uploadPromises.push(
          uploadFileToSupabase(
            documents.utilityBill.file,
            `${userId}/utility-bills`
          ).then((path) => {
            documentPaths.utility_bill_path = path;
            console.log("Utility bill uploaded:", path);
          })
        );
      }

      if (documents.selfie) {
        console.log("Uploading selfie...");
        uploadPromises.push(
          uploadFileToSupabase(documents.selfie.file, `${userId}/selfies`).then(
            (path) => {
              documentPaths.selfie_path = path;
              console.log("Selfie uploaded:", path);
            }
          )
        );
      }

      await Promise.all(uploadPromises);
      console.log("All files uploaded successfully:", documentPaths);

      // Insert KYC data into database
      console.log("Inserting KYC data into database...");
      const kycData = {
        user_id: userId,
        document_type: formData.documentType,
        document_number: formData.documentNumber,
        full_name: formData.fullName,
        date_of_birth: formData.dateOfBirth,
        address: formData.address,
        city: formData.city,
        country: formData.country,
        postal_code: formData.postalCode,
        ...documentPaths,
        status: "pending",
        submitted_at: new Date().toISOString(),
      };

      console.log("KYC data to insert:", kycData);

      const { data: insertData, error: dbError } = await supabase
        .from("kyc_verifications")
        .insert(kycData)
        .select();

      if (dbError) {
        console.error("Database insert error:", dbError);
        throw new Error(`Database error: ${dbError.message}`);
      }

      console.log("KYC data inserted successfully:", insertData);

      // Update user's KYC status to pending
      console.log("Updating user KYC status to pending...");
      const { error: userUpdateError } = await supabase
        .from("users")
        .update({ kyc_status: "pending" })
        .eq("id", userId);

      if (userUpdateError) {
        console.error("User update error:", userUpdateError);
        // Don't throw here - the KYC was submitted successfully
        console.log(
          "KYC submitted but user status update failed - this is okay"
        );
      } else {
        console.log("User KYC status updated successfully");
        setKycStatus("pending"); // Update local state
      }

      setSuccess(
        "KYC verification submitted successfully! Your documents are being reviewed."
      );
    } catch (error: any) {
      console.error("KYC submission error:", error);
      setError(`KYC submission failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const removeFile = (type: keyof typeof documents) => {
    if (documents[type]?.preview.startsWith("blob:")) {
      URL.revokeObjectURL(documents[type]!.preview);
    }
    setDocuments((prev) => ({
      ...prev,
      [type]: null,
    }));
  };

  // Show loading state while checking KYC status
  if (checkingStatus) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="shadow-lg max-w-md w-full">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0A7F8D] mb-4"></div>
            <p className="text-gray-600">Checking KYC status...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show status-specific content based on KYC status
  const renderStatusContent = () => {
    switch (kycStatus) {
      case "approved":
        // This case should not be reached as we call onKYCComplete() immediately
        return (
          <div className="text-center py-8">
            <ShieldCheck className="mx-auto h-12 w-12 text-green-600 mb-4" />
            <h3 className="text-lg font-semibold text-green-800 mb-2">
              KYC Approved
            </h3>
            <p className="text-gray-600 mb-4">
              Your identity has been verified successfully.
            </p>
            <Button
              onClick={onKYCComplete}
              className="bg-[#0A7F8D] hover:bg-[#0A7F8D] text-white px-6 py-2"
            >
              Continue
            </Button>
          </div>
        );

      case "pending":
        return (
          <div className="text-center py-8">
            <Clock className="mx-auto h-12 w-12 text-yellow-600 mb-4" />
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">
              KYC Under Review
            </h3>
            <p className="text-gray-600 mb-4">
              Your documents are currently being reviewed by our team. This
              process typically takes 1-3 business days.
            </p>
            <Alert className="border-yellow-200 bg-yellow-50 text-left">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                You will receive an email notification once your verification is
                complete. Please check back later or contact support if you have
                any questions.
              </AlertDescription>
            </Alert>
          </div>
        );

      case "rejected":
        return (
          <div className="text-center py-8">
            <XCircle className="mx-auto h-12 w-12 text-red-600 mb-4" />
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              KYC Verification Failed
            </h3>
            <p className="text-gray-600 mb-4">
              Your identity verification was not approved. Please review the
              requirements and submit new documents.
            </p>
            <Alert variant="destructive" className="text-left mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Common reasons for rejection: blurry images, expired documents,
                or information mismatch. Please ensure all documents are clear,
                valid, and match your provided information.
              </AlertDescription>
            </Alert>
            <Button
              onClick={() => setKycStatus("not_started")}
              className="bg-[#0A7F8D] hover:bg-[#0A7F8D] text-white px-6 py-2"
            >
              Resubmit Documents
            </Button>
          </div>
        );

      case "not_started":
      default:
        // Show the KYC form for initial submission
        return (
          <>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  {success}
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmitKYC} className="space-y-6">
              {/* Personal Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <input
                    id="fullName"
                    type="text"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    className="w-full mt-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0A7F8D] focus:border-transparent"
                    required
                    title="Enter your full legal name"
                    placeholder="Enter your full name"
                    aria-describedby="fullName-description"
                  />
                </div>

                <div>
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) =>
                      setFormData({ ...formData, dateOfBirth: e.target.value })
                    }
                    className="w-full mt-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0A7F8D] focus:border-transparent"
                    required
                    title="Select your date of birth"
                    aria-describedby="dateOfBirth-description"
                  />
                </div>

                <div>
                  <Label htmlFor="documentType">Document Type</Label>
                  <select
                    id="documentType"
                    value={formData.documentType}
                    onChange={(e) =>
                      setFormData({ ...formData, documentType: e.target.value })
                    }
                    className="w-full mt-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0A7F8D] focus:border-transparent"
                    required
                    title="Select your document type"
                    aria-describedby="documentType-description"
                  >
                    <option value="passport">Passport</option>
                    <option value="id_card">National ID Card</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="documentNumber">Document Number</Label>
                  <input
                    id="documentNumber"
                    type="text"
                    value={formData.documentNumber}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        documentNumber: e.target.value,
                      })
                    }
                    className="w-full mt-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0A7F8D] focus:border-transparent"
                    required
                    title="Enter your document number"
                    placeholder="Enter document number"
                    aria-describedby="documentNumber-description"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <input
                    id="address"
                    type="text"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    className="w-full mt-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0A7F8D] focus:border-transparent"
                    required
                    title="Enter your full address"
                    placeholder="Enter your full address"
                    aria-describedby="address-description"
                  />
                </div>

                <div>
                  <Label htmlFor="city">City</Label>
                  <input
                    id="city"
                    type="text"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    className="w-full mt-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0A7F8D] focus:border-transparent"
                    required
                    title="Enter your city"
                    placeholder="Enter your city"
                    aria-describedby="city-description"
                  />
                </div>

                <div>
                  <Label htmlFor="country">Country</Label>
                  <input
                    id="country"
                    type="text"
                    value={formData.country}
                    onChange={(e) =>
                      setFormData({ ...formData, country: e.target.value })
                    }
                    className="w-full mt-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0A7F8D] focus:border-transparent"
                    required
                    title="Enter your country"
                    placeholder="Enter your country"
                    aria-describedby="country-description"
                  />
                </div>

                <div>
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <input
                    id="postalCode"
                    type="text"
                    value={formData.postalCode}
                    onChange={(e) =>
                      setFormData({ ...formData, postalCode: e.target.value })
                    }
                    className="w-full mt-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0A7F8D] focus:border-transparent"
                    title="Enter your postal code"
                    placeholder="Enter postal code"
                    aria-describedby="postalCode-description"
                  />
                </div>
              </div>

              {/* Document Upload Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Required Documents</h3>

                {/* ID Document */}
                <DocumentUpload
                  title="ID Document (Passport/National ID) *"
                  description="Upload a clear photo of your passport or national ID card"
                  file={documents.idDocument}
                  onFileSelect={(file) => handleFileUpload("idDocument", file)}
                  onRemove={() => removeFile("idDocument")}
                />

                {/* Utility Bill */}
                <DocumentUpload
                  title="Utility Bill *"
                  description="Upload a recent water or electricity bill (not older than 3 months)"
                  file={documents.utilityBill}
                  onFileSelect={(file) => handleFileUpload("utilityBill", file)}
                  onRemove={() => removeFile("utilityBill")}
                />

                {/* Driver License (Optional) */}
                <DocumentUpload
                  title="Driver License (Optional)"
                  description="Upload your driver license if available"
                  file={documents.driverLicense}
                  onFileSelect={(file) =>
                    handleFileUpload("driverLicense", file)
                  }
                  onRemove={() => removeFile("driverLicense")}
                />

                {/* Selfie */}
                <DocumentUpload
                  title="Selfie *"
                  description="Upload a clear selfie holding your ID document"
                  file={documents.selfie}
                  onFileSelect={(file) => handleFileUpload("selfie", file)}
                  onRemove={() => removeFile("selfie")}
                />
              </div>

              <div className="flex justify-center pt-6">
                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full md:w-auto px-8 py-3 bg-[#0A7F8D] hover:bg-[#0A7F8D] text-white font-medium rounded-md transition-all duration-300 disabled:opacity-50"
                      >
                        {loading ? "Submitting KYC..." : "Submit KYC Verification"}
                      </Button>
                    </div>
            </form>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900">
              KYC Verification
            </CardTitle>
            <p className="text-gray-600 mt-2">
              To comply with banking regulations, please complete your identity
              verification
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {renderStatusContent()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Document Upload Component
interface DocumentUploadProps {
  title: string;
  description: string;
  file: UploadedFile | null;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
}

function DocumentUpload({
  title,
  description,
  file,
  onFileSelect,
  onRemove,
}: DocumentUploadProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      onFileSelect(selectedFile);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-medium text-gray-900">{title}</h4>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
        {file && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-red-500 hover:text-red-700"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {!file ? (
  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#0A7F8D] transition-colors relative">
          <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <div className="text-sm text-gray-600 mb-2">
            Click to upload or drag and drop
          </div>
          <div className="text-xs text-gray-500">PNG, JPG, PDF up to 10MB</div>
          <label
            htmlFor={`file-upload-${title.replace(/\s+/g, "-").toLowerCase()}`}
            className="sr-only"
          >
            {title}
          </label>
          <input
            id={`file-upload-${title.replace(/\s+/g, "-").toLowerCase()}`}
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label={`Upload ${title}`}
            title={`Upload ${title}`}
          />
        </div>
      ) : (
        <div className="flex items-center space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">
              {file.file.name}
            </p>
            <p className="text-xs text-green-600">
              {(file.file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
