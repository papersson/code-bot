"use client";

import React from "react";

/**
 * Home page: does NOT render ChatInterface anymore.
 * It simply displays a message telling the user to create a new chat
 * or pick one from the sidebar.
 */
export default function Home() {
  return (
    <div className="h-full w-full flex items-center justify-center">
      <p className="text-sm text-muted-foreground">
        Create a new chat or select one from the sidebar.
      </p>
    </div>
  );
}
