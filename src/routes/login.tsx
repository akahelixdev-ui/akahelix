import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    throw redirect({ href: "https://app.akahelix.com" });
  },
  component: () => {
    useEffect(() => {
      window.location.href = "https://app.akahelix.com";
    }, []);
    return null;
  },
});
