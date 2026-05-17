import Header from "@/components/header";
import Providers from "@/components/providers";
import { TauriInit } from "@/components/tauri-init";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Providers>
      <TauriInit />
      <div className="grid h-svh grid-rows-[auto_1fr]">
        <Header />
        {children}
      </div>
    </Providers>
  );
}
