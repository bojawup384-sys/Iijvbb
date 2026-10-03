import type { Metadata } from "next";
import { Suspense } from "react";
import { ChatPage } from "@/components/app/chat";

export const metadata: Metadata = {
  title: "المحادثة",
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ChatPage />
    </Suspense>
  );
}
