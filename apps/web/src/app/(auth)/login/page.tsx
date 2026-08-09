"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/stores/auth-store";
import { fetchApi } from "@/lib/api";
import { GradientButton } from "@/components/GradientButton";
import { Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, isAuthenticated, hasHydrated } = useAuthStore();

  React.useEffect(() => {
    if (hasHydrated && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [hasHydrated, isAuthenticated, router]);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Real API call to NestJS auth endpoint
      const tokens = await fetchApi("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
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
      
      toast.success(`Welcome back, ${userProfile.username}!`);
      router.push("/dashboard");
    } catch (err: any) {
      const msg = err.message || "Invalid credentials or login failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Welcome Back</h1>
      <p className="text-muted mb-6">Log in to your ListenIn account</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-error/10 text-error text-sm p-3 rounded-lg border border-error/20">
            {error}
          </div>
        )}

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
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-dim">Password</label>
            <Link href="#" className="text-xs text-primary hover:text-primary-hover">Forgot password?</Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-3 text-muted" size={18} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-dim focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all"
              placeholder="••••••••"
              required
            />
          </div>
        </div>

        <GradientButton type="submit" isLoading={isLoading} className="mt-6 glow-primary">
          Log In
        </GradientButton>
      </form>

      <div className="mt-6 text-center text-sm text-dim">
        Don't have an account?{" "}
        <Link href="/register" className="text-primary hover:text-primary-hover font-medium">
          Sign up
        </Link>
      </div>
    </div>
  );
}
