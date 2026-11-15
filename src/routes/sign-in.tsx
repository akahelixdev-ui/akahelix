import { ArrowUpRight } from "@phosphor-icons/react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/sign-in")({
  beforeLoad: () => {
    throw redirect({ href: "https://app.akahelix.com" });
  },
  head: () => ({
    meta: [
      { title: "Redirecting to AKAHELIX Client Portal..." },
      { httpEquiv: "refresh", content: "0;url=https://app.akahelix.com" },
    ],
  }),
  component: SignInRedirect,
});

function SignInRedirect() {
  useEffect(() => {
    window.location.href = "https://app.akahelix.com";
  }, []);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <p className="label-mono text-muted-foreground">Redirecting to app.akahelix.com...</p>
      <a
        href="https://app.akahelix.com"
        className="mt-4 inline-flex items-center gap-2 rounded-[4px] bg-blue px-4 py-2 text-sm text-on-blue hover:bg-blue-deep"
      >
        <span>Open AKAHELIX App</span>
        <ArrowUpRight className="size-4" />
      </a>
    </div>
  );
}
