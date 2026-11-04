declare module "qrcode" {
  interface QRCodeOptions {
    width?: number;
    margin?: number;
    color?: { dark?: string; light?: string };
  }

  const QRCode: {
    toDataURL(data: string, options?: QRCodeOptions): Promise<string>;
  };

  export default QRCode;
}
