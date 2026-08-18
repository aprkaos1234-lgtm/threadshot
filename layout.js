
import "./styles.css";
export const metadata = {
  title: "ThreadShot V4",
  description: "핫쇼핑템 → 쿠팡 확인 → Threads 글/답글",
  manifest: "/manifest.webmanifest"
};
export default function RootLayout({children}) {
  return <html lang="ko"><body>{children}</body></html>;
}
