"use client";

import { signIn } from "next-auth/react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  const handleSignIn = () => {
    signIn("microsoft-entra-id", {
      callbackUrl: "/",
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-main">
      <Card className="w-[440px] shadow-md">
        <CardHeader>
          <h2 className="text-2xl font-semibold text-gray-900">Welcome</h2>
          <p className="text-sm text-gray-600">Sign in to access your chats</p>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleSignIn}
            className="w-full bg-[#2F2F2F] hover:bg-[#1F1F1F]"
            variant="default"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z"/>
            </svg>
            Sign in with Microsoft Entra ID
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}