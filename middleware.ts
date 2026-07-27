import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Routes that REQUIRE an authenticated user. clerkMiddleware is public-by-default
// (the inverse of v4 authMiddleware), so we enumerate only what must be gated.
// Everything not matched here stays public: '/' (public gallery), the sign-in/up
// pages, and the two webhook endpoints (which authenticate via their own signature
// secrets — do NOT add them here or their POSTs would 302 to sign-in).
const isProtectedRoute = createRouteMatcher([
  "/profile(.*)",
  "/credits(.*)",
  "/transformations(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // auth.protect() is async in Clerk v6; it resolves the session and, if
  // unauthenticated, throws a redirect to the sign-in URL.
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next internals + static files, but always run on API/tRPC routes so
    // server-side auth() has session context.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
