"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Activity, LockKeyhole, Mail, ShieldAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

import { Suspense } from "react"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/"
  
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      })

      if (res?.error) {
        setError("Invalid email or password")
        setLoading(false)
      } else {
        router.push(callbackUrl)
      }
    } catch (err) {
      setError("An error occurred during login")
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div className="space-y-2 relative group">
        <Mail className="absolute left-3 top-5 h-4 w-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
        <Input 
          type="email" 
          placeholder="doctor@clinic.com" 
          className="pl-10 h-14 rounded-xl border-2 border-blue-100 bg-white shadow-sm focus-visible:ring-0 focus-visible:border-blue-500 transition-colors font-medium"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2 relative group">
        <LockKeyhole className="absolute left-3 top-5 h-4 w-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
        <Input 
          type="password" 
          placeholder="••••••••" 
          className="pl-10 h-14 rounded-xl border-2 border-blue-100 bg-white shadow-sm focus-visible:ring-0 focus-visible:border-blue-500 transition-colors font-medium"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      
      {error && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }} 
          animate={{ opacity: 1, height: 'auto' }} 
          className="text-sm font-medium text-red-500 text-center"
        >
          {error}
        </motion.div>
      )}
      
      <Button 
        type="submit" 
        className="w-full h-14 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-base shadow-md shadow-blue-600/20 transition-all font-semibold"
        disabled={loading}
      >
        {loading ? "Authenticating..." : "Sign In"}
      </Button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-50 relative overflow-hidden font-sans">
      {/* Decorative Background (Matching Dashboard) */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400/20 blur-[100px] mix-blend-multiply" />
      <div className="absolute top-[20%] right-[-10%] w-[30%] h-[50%] rounded-full bg-indigo-400/20 blur-[100px] mix-blend-multiply" />
      
      {/* Header (Matching Dashboard) */}
      <header className="w-full h-16 px-8 flex items-center border-b border-slate-200/50 bg-white/50 backdrop-blur-md z-10 absolute top-0">
        <div className="flex items-center gap-2 font-bold text-xl text-slate-900 tracking-tight">
          <Activity className="h-6 w-6 text-blue-600" />
          <span>ClinicGit</span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm font-medium text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200/50">
          <ShieldAlert className="h-4 w-4" />
          Authentication Required
        </div>
      </header>

      <div className="flex-1 w-full flex items-center justify-center z-10">
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md z-10 px-4"
      >
        <Card className="border-white/40 bg-white/70 backdrop-blur-xl shadow-[0_8px_40px_rgb(0,0,0,0.04)]">
          <CardHeader className="space-y-3 pb-6 text-center">
            <div className="mx-auto w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20 mb-2">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-2xl font-semibold tracking-tight text-slate-900">
              Welcome to ClinicGit
            </CardTitle>
            <CardDescription className="text-slate-500">
              Enter your credentials to access the clinical tracking system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="text-sm text-center text-slate-500">Loading form...</div>}>
              <LoginForm />
            </Suspense>
          </CardContent>
          <CardFooter className="flex justify-center border-t border-slate-100/50 pt-6 pb-2">
            <p className="text-xs text-slate-400">
              Secure clinical environment. Unauthorized access is prohibited.
            </p>
          </CardFooter>
        </Card>
      </motion.div>
      </div>
    </div>
  )
}
