import './globals.css';

export const metadata = {
  title: 'TEM Anchor Degradation Test',
  description: 'Flux → ASCII → SVG anchor degradation test',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect fill='%2312121a' width='32' height='32'/><text x='16' y='22' fill='%23c4a882' font-size='18' text-anchor='middle' font-family='serif'>T</text></svg>" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{
        margin: 0,
        backgroundColor: '#12121a',
        color: '#c4a882',
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        minHeight: '100vh',
      }}>
        {children}
      </body>
    </html>
  );
}
