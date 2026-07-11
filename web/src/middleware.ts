import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/applications/:path*",
    "/dashboard/:path*",
    "/interview-prep/:path*",
    "/jobs/:path*",
    "/onboarding/:path*",
    "/profile/:path*",
    "/projects/:path*",
    "/roadmap/:path*",
    "/resume/:path*",
    "/settings/:path*",
    "/start/:path*",
  ],
};
