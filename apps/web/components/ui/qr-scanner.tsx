"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QrScanner } from "@yudiel/react-qr-scanner";
import { Camera, CameraOff, CheckCircle, XCircle } from "lucide-react";
import { useRef, useState } from "react";

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
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );
  const scannerRef = useRef<any>(null);

  const handleScan = (result: string) => {
    setLastResult(result);
    setScanStatus("success");
    onScan(result);

    // Stop scanning after successful scan
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
    setLastResult(null);
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
        {isScanning ? (
          <div className="relative">
            <QrScanner
              ref={scannerRef}
              onDecode={handleScan}
              onError={handleError}
              containerStyle={{
                width: "100%",
                height: "300px",
                borderRadius: "8px",
                overflow: "hidden",
              }}
              videoStyle={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />

            {/* Overlay with scanning status */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/50 text-white px-4 py-2 rounded-lg">
                {scanStatus === "success" && (
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    <span>Scan Successful!</span>
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
              <p>Click "Start Scanning" to begin</p>
            </div>
          </div>
        )}

        {lastResult && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-1">
              Last Scan Result:
            </p>
            <p className="text-xs text-gray-600 break-all">{lastResult}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
