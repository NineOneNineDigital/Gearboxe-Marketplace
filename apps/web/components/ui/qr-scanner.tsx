"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scanner } from "@yudiel/react-qr-scanner";
import { Camera, CameraOff, XCircle } from "lucide-react";
import { useState } from "react";

interface QRScannerProps {
  onScan: (data: string) => void;
  onError?: (error: Error) => void;
  title?: string;
}

export function QRScannerComponent({
  onScan,
  onError,
  title = "QR Code Scanner",
}: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);

  const [scanStatus, setScanStatus] = useState<"idle" | "captured" | "error">(
    "idle"
  );
  const handleScan = (result: string) => {
    setScanStatus("captured");
    setIsScanning(false);
    onScan(result);

    // Capture is not an admission confirmation.
    setTimeout(() => {
      setIsScanning(false);
      setScanStatus("idle");
    }, 2000);
  };

  const handleError = (error: Error) => {
    setScanStatus("error");
    onError?.(error);

    setTimeout(() => {
      setScanStatus("idle");
    }, 2000);
  };

  const toggleScanning = () => {
    setIsScanning(!isScanning);
    setScanStatus("idle");

  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-lg">{title}</CardTitle>
        <div className="flex justify-center">
          <Button
            onClick={toggleScanning}
            variant={isScanning ? "destructive" : "default"}
            size="sm"
          >
            {isScanning ? (
              <>
                <CameraOff className="h-4 w-4 mr-2" />
                Stop Scanning
              </>
            ) : (
              <>
                <Camera className="h-4 w-4 mr-2" />
                Start Scanning
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {scanStatus === "captured" && <p role="status">Code captured. Await backend validation before admission.</p>}
        {isScanning ? (
          <div className="relative">
            <Scanner
              onScan={(codes) => {
                const value = codes[0]?.rawValue;
                if (value) handleScan(value);
              }}
              onError={(error) =>
                handleError(
                  error instanceof Error ? error : new Error("QR scan failed")
                )
              }
              styles={{
                container: {
                  width: "100%",
                  height: "300px",
                  borderRadius: "8px",
                  overflow: "hidden",
                },
                video: {
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                },
              }}
            />

            {/* Overlay with scanning status */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/50 text-white px-4 py-2 rounded-lg">
                {scanStatus === "captured" && (
                  <div className="flex items-center space-x-2">
                    <span>Code captured — backend validation required</span>
                  </div>
                )}
                {scanStatus === "error" && (
                  <div className="flex items-center space-x-2">
                    <XCircle className="h-5 w-5 text-red-400" />
                    <span>Scan Error</span>
                  </div>
                )}
                {scanStatus === "idle" && <span>Point camera at QR code</span>}
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center">
            <div className="text-center text-gray-500">
              <Camera className="h-12 w-12 mx-auto mb-2" />
              <p>Click &quot;Start Scanning&quot; to begin</p>
            </div>
          </div>
        )}


      </CardContent>
    </Card>
  );
}
