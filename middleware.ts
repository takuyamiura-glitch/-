import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/meeting-rooms/:path*",
    "/api/availability/:path*",
    "/api/bookings/:path*",
  ],
};
