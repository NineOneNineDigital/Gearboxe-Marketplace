"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Share } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

interface QRDisplayProps {
  qrCodeData: string;
  title?: string;
  description?: string;
}

export function QRDisplay({
  qrCodeData,
  title = "QR Code",
  description,
}: QRDisplayProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  useEffect(() => {
    const generateQRCode = async () => {
      try {
        const url = await QRCode.toDataURL(qrCodeData, {
          width: 256,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        });
        setQrCodeUrl(url);
      } catch (error) {
        console.error("Error generating QR code:", error);
      }
    };

    generateQRCode();
  }, [qrCodeData]);

  const handleDownload = () => {
    if (!qrCodeUrl) return;

    const link = document.createElement("a");
    link.download = `qr-code-${Date.now()}.png`;
    link.href = qrCodeUrl;
    link.click();
  };

  const handleShare = async () => {
    if (!qrCodeUrl) return;

    if (navigator.share) {
      try {
        const response = await fetch(qrCodeUrl);
        const blob = await response.blob();
        const file = new File([blob], `qr-code-${Date.now()}.png`, {
          type: "image/png",
        });

        await navigator.share({
          title: title,
          text: description,
          files: [file],
        });
      } catch (error) {
        console.error("Error sharing:", error);
      }
    } else {
      // Fallback: copy to clipboard or download
      handleDownload();
    }
  };

  return (
    <Card className="w-full max-w-sm mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && <p className="text-sm text-gray-600">{description}</p>}
      </CardHeader>
      <CardContent className="text-center space-y-4">
        {qrCodeUrl ? (
          <div className="flex justify-center">
            <img src={qrCodeUrl} alt="QR Code" className="border rounded-lg" />
          </div>
        ) : (
          <div className="w-64 h-64 bg-gray-200 rounded-lg flex items-center justify-center">
            <span className="text-gray-500">Generating QR Code...</span>
          </div>
        )}

        <div className="flex gap-2 justify-center">
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
