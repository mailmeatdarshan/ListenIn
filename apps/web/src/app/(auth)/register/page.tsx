"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/stores/auth-store";
import { fetchApi } from "@/lib/api";
import { GradientButton } from "@/components/GradientButton";
import { Mail, Lock, User as UserIcon } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }

      // Real API call to NestJS auth register endpoint
      const tokens = await fetchApi("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
        }),
      });

      // Store tokens temporarily so fetchApi can attach Authorization header for /users/me
      useAuthStore.setState({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });

      // Fetch user profile from /users/me
      const userProfile = await fetchApi("/users/me");

      setAuth(
        { id: userProfile.id, username: userProfile.username, email: userProfile.email },
        tokens.accessToken,
        tokens.refreshToken
      );
      
      toast.success("Account created successfully!");
      router.push("/dashboard");
    } catch (err: any) {
      const msg = err.message || "Registration failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Create Account</h1>
      <p className="text-muted mb-6">Join ListenIn and start your listening party</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-error/10 text-error text-sm p-3 rounded-lg border border-error/20">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-sm font-medium text-dim">Username</label>
          <div className="relative">
            <UserIcon className="absolute left-3 top-3 text-muted" size={18} />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-dim focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all"
              placeholder="musicfan99"
              required
              minLength={3}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-dim">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 text-muted" size={18} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-dim focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all"
              placeholder="you@example.com"
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-dim">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 text-muted" size={18} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-dim focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all"
              placeholder="••••••••"
              required
              minLength={8}
            />
          </div>
        </div>

        <GradientButton type="submit" isLoading={isLoading} className="mt-6 glow-primary">
          Sign Up
        </GradientButton>
      </form>

      <div className="mt-6 text-center text-sm text-dim">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:text-primary-hover font-medium">
          Log in
        </Link>
      </div>
    </div>
  );
}
