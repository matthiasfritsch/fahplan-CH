export const metadata = {
  title: "Fahrplan-Board",
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body style={{ margin: 0, background: "#e8e8e6", fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
