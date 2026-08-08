export const metadata = {
  title: {
    default: "Авторынок",
    template: "%s | Авторынок",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}