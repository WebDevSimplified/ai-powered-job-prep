import arcjet, { detectBot, shield, slidingWindow } from "@arcjet/next"
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { env } from "./data/env/server"

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/",
  "/api/webhooks(.*)",
])

const aj = arcjet({
  key: env.ARCJET_KEY,
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({
      mode: "LIVE",
      allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:MONITOR", "CATEGORY:PREVIEW"],
    }),
    slidingWindow({
      mode: "LIVE",
      interval: "1m",
      max: 100,
    }),
  ],
})

export default clerkMiddleware(async (auth, req) => {
  const decision = await aj.protect(req)

  if (decision.isDenied()) {
    return new Response(null, { status: 403 })
  }

  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}
