import { useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { UserPlus } from "lucide-react"

export function CreatePatientDialog({ 
  open, 
  onOpenChange 
}: { 
  open: boolean, 
  onOpenChange: (open: boolean) => void 
}) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [age, setAge] = useState("")
  const [gender, setGender] = useState("")
  const [weight, setWeight] = useState("")
  const [height, setHeight] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, age, gender, weight, height })
      })
      
      const data = await res.json()
      
      if (res.ok) {
        onOpenChange(false)
        router.push(`/patients/${data.id}`)
      } else {
        setError(data.error || "Failed to create patient")
      }
    } catch (err) {
      setError("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] bg-white/95 backdrop-blur-xl border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            Add New Patient
          </DialogTitle>
          <DialogDescription>
            Register a new patient to start their clinical record.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-slate-500">Patient Full Name</label>
            <Input 
              required 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="e.g. John Doe" 
              className="bg-white" 
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-slate-500">Age</label>
              <Input 
                type="number"
                value={age} 
                onChange={e => setAge(e.target.value)} 
                placeholder="e.g. 45" 
                className="bg-white" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-slate-500">Gender</label>
              <Input 
                value={gender} 
                onChange={e => setGender(e.target.value)} 
                placeholder="e.g. Female" 
                className="bg-white" 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-slate-500">Weight</label>
              <Input 
                value={weight} 
                onChange={e => setWeight(e.target.value)} 
                placeholder="e.g. 68 kg" 
                className="bg-white" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-slate-500">Height</label>
              <Input 
                value={height} 
                onChange={e => setHeight(e.target.value)} 
                placeholder="e.g. 165 cm" 
                className="bg-white" 
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={loading || !name.trim()}>
              {loading ? "Creating..." : "Create Patient"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
