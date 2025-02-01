import { authOptions } from "@/auth";
import NextAuth from "next-auth";

// Since NextAuth 5 with the App Router uses these handler exports:
export const GET = NextAuth(authOptions).handlers.GET;
export const POST = NextAuth(authOptions).handlers.POST;