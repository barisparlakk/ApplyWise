import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/jobs/:path*",
    "/profile/:path*",
    "/projects/:path*",
    "/resume/:path*",
    "/settings/:path*",
  ],
};
