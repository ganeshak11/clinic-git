"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Activity, GitBranch, ArrowRight, ShieldCheck, X, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CreatePatientDialog } from "./create-patient-dialog"

export default function HomeDashboard() {
  const router = useRouter()
  const [isSearching, setIsSearching] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [patientId, setPatientId] = useState("")
  const [searchResult, setSearchResult] = useState<{ id: string, name: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!patientId.trim()) return

    setLoading(true)
    setError("")
    setSearchResult(null)

    try {
      // In a real app, this calls /api/patient/[id]
      const res = await fetch(`/api/patient/${patientId}`)
      if (res.ok) {
        const data = await res.json()
        setSearchResult({ id: data.id, name: data.name })
      } else {
        setError("No exact match found for this Secret ID.")
      }
    } catch (err) {
      setError("An error occurred.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 flex flex-col relative overflow-hidden font-sans">
      
      {/* Decorative Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400/20 blur-[100px] mix-blend-multiply" />
      <div className="absolute top-[20%] right-[-10%] w-[30%] h-[50%] rounded-full bg-indigo-400/20 blur-[100px] mix-blend-multiply" />
      
      {/* Header */}
      <header className="w-full h-16 px-8 flex items-center border-b border-slate-200/50 bg-white/50 backdrop-blur-md z-10">
        <div className="flex items-center gap-2 font-bold text-xl text-slate-900 tracking-tight">
          <Activity className="h-6 w-6 text-blue-600" />
          <span>ClinicGit</span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
          <ShieldCheck className="h-4 w-4 text-green-600" />
          Secure Session
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 z-10">
        
        {/* Animated Mock Graph Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-12 max-w-2xl"
        >
          <div className="flex justify-center mb-6">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full border border-dashed border-blue-300"
              />
              <div className="absolute w-4 h-4 bg-blue-500 rounded-full -top-2 left-14 shadow-lg shadow-blue-500/50" />
              <div className="absolute w-4 h-4 bg-indigo-500 rounded-full bottom-4 right-2 shadow-lg shadow-indigo-500/50" />
              <div className="absolute w-4 h-4 bg-slate-400 rounded-full bottom-4 left-2" />
              <GitBranch className="h-12 w-12 text-blue-600" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            The Truth is in the <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Branches.</span>
          </h1>
          <p className="text-lg text-slate-500">
            A graph-native clinical tracking system for differential diagnoses, exact evidence chaining, and transparent medical history.
          </p>
        </motion.div>

        {/* Search Interaction Area */}
        <div className="w-full max-w-xl h-[120px] relative flex justify-center items-start">
          <AnimatePresence mode="wait">
            {!isSearching ? (
              <motion.div
                key="button"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
                transition={{ duration: 0.3 }}
                className="w-full flex gap-4"
              >
                <Button 
                  onClick={() => setIsSearching(true)}
                  className="flex-1 h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-lg font-medium shadow-xl shadow-slate-900/10 flex items-center justify-center gap-3 transition-transform hover:scale-[1.02]"
                >
                  <Search className="w-5 h-5" />
                  Search a patient
                </Button>
                
                <Button 
                  onClick={() => setIsCreateOpen(true)}
                  variant="outline"
                  className="flex-1 h-14 rounded-2xl bg-white border-2 border-blue-100 hover:border-blue-500 text-blue-600 hover:bg-blue-50 text-lg font-medium shadow-xl shadow-blue-900/5 flex items-center justify-center gap-3 transition-all hover:scale-[1.02]"
                >
                  <UserPlus className="w-5 h-5" />
                  Add New Patient
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="searchbar"
                initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, type: "spring", bounce: 0.2 }}
                className="w-full"
              >
                <form onSubmit={handleSearch} className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-blue-600" />
                  </div>
                  <Input 
                    type="text"
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    placeholder="Enter Exact Secret Patient ID..."
                    className="w-full h-16 pl-12 pr-24 rounded-2xl border-2 border-blue-100 bg-white shadow-xl shadow-blue-900/5 text-lg font-medium focus-visible:ring-0 focus-visible:border-blue-500 transition-colors"
                    autoFocus
                  />
                  <div className="absolute inset-y-0 right-2 flex items-center gap-1">
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon"
                      className="h-10 w-10 rounded-xl text-slate-400 hover:text-slate-600"
                      onClick={() => {
                        setIsSearching(false)
                        setSearchResult(null)
                        setError("")
                        setPatientId("")
                      }}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={loading || !patientId.trim()}
                      className="h-10 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 shadow-md shadow-blue-600/20"
                    >
                      {loading ? "..." : <ArrowRight className="h-5 w-5" />}
                    </Button>
                  </div>
                </form>

                {/* Exact Match Results */}
                <AnimatePresence>
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium text-center"
                    >
                      {error}
                    </motion.div>
                  )}
                  {searchResult && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-200/50"
                    >
                      <div className="p-2">
                        <button 
                          onClick={() => router.push(`/patients/${searchResult.id}`)}
                          className="w-full text-left p-4 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-between group"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{searchResult.name}</p>
                            <p className="text-xs text-slate-500 font-mono mt-1">ID: {searchResult.id}</p>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                            <ArrowRight className="h-4 w-4 text-blue-600 group-hover:text-white transition-colors" />
                          </div>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <CreatePatientDialog 
        open={isCreateOpen} 
        onOpenChange={setIsCreateOpen} 
      />
    </div>
  )
}
