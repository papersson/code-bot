import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

export const authOptions = {
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    }),
  ],
  secret: process.env.AUTH_SECRET,
  // In a real app, you'd configure callbacks to populate user.id, etc.
  callbacks: {
    async session({ session, token }: any) {
      // e.g. store the user token or ID in session
      if (token?.email) {
        session.user.email = token.email;
      }
      return session;
    },
  },
};

export default NextAuth(authOptions);