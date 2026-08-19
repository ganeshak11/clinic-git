import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GitBranch, GitCommit, FileUp, ShieldCheck, Plus, Trash2 } from "lucide-react"

interface EvidenceFact {
  key: string;
  value: string;
}

export function CreateCommitDialog({ 
  open, 
  onOpenChange, 
  patientId,
  onSuccess
}: { 
  open: boolean, 
  onOpenChange: (open: boolean) => void,
  patientId: string,
  onSuccess: () => void
}) {
  const [step, setStep] = useState<"choose" | "form">("choose")
  const [mode, setMode] = useState<"same" | "new">("same")
  const [uploading, setUploading] = useState(false)
  const [fileUrl, setFileUrl] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  
  const [conclusion, setConclusion] = useState("")
  const [evidenceList, setEvidenceList] = useState<EvidenceFact[]>([{ key: "", value: "" }])
  const [prescription, setPrescription] = useState("")
  const [justification, setJustification] = useState("")

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setUploading(true)
    const formData = new FormData()
    formData.append("file", file)
    
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
      })
      const data = await res.json()
      if (data.url) {
        setFileUrl(data.url)
        setError("")
      } else {
        setError(data.error || "Upload failed from server")
      }
    } catch (err: any) {
      console.error("Upload failed", err)
      setError(err.message || "Network error during upload")
    } finally {
      setUploading(false)
    }
  }

  const handleAddEvidence = () => {
    setEvidenceList([...evidenceList, { key: "", value: "" }])
  }

  const handleRemoveEvidence = (index: number) => {
    setEvidenceList(evidenceList.filter((_, i) => i !== index))
  }

  const handleEvidenceChange = (index: number, field: "key" | "value", val: string) => {
    const newEvidence = [...evidenceList]
    if (newEvidence[index]) {
      newEvidence[index][field] = val
    }
    setEvidenceList(newEvidence)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    try {
      let activeBranchId: string | undefined = undefined;

      // 1. Create a New Branch if mode === "new"
      if (mode === "new") {
        const branchRes = await fetch("/api/branch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patientId, question: justification })
        });
        if (!branchRes.ok) throw new Error("Failed to create branch");
        const branchData = await branchRes.json();
        activeBranchId = branchData.id;
      }

      // 2. Create Facts from the Evidence List
      const factIds: string[] = [];
      const validEvidence = evidenceList.filter(e => e.key.trim() !== "" && e.value.trim() !== "");
      
      // If there's a file but no text evidence, we should still create a fact for the file
      if (validEvidence.length === 0 && fileUrl) {
        validEvidence.push({ key: "Attachment", value: "Clinical Report" });
      } else if (validEvidence.length === 0) {
        throw new Error("You must provide at least one piece of clinical evidence.");
      }

      for (let i = 0; i < validEvidence.length; i++) {
        const ev = validEvidence[i];
        const isLastFact = i === validEvidence.length - 1;
        const factUrl = (isLastFact && fileUrl) ? fileUrl : undefined;
        
        const factRes = await fetch("/api/fact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId,
            type: "observation",
            value: `${ev?.key}: ${ev?.value}`,
            recordedAt: new Date().toISOString(),
            attachmentUrl: factUrl
          })
        });
        if (!factRes.ok) throw new Error("Failed to save clinical evidence");
        const factData = await factRes.json();
        factIds.push(factData.id);
      }

      // 3. Create Interpretation (The Diagnosis Commit)
      const interpRes = await fetch("/api/interpretation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          summary: conclusion,
          supportingFactIds: factIds,
          branchId: activeBranchId // backend uses undefined/null to indicate no branch
        })
      });
      if (!interpRes.ok) throw new Error("Failed to create diagnosis commit");
      const interpData = await interpRes.json();

      // 4. Create Decision if prescription exists
      if (prescription.trim() !== "") {
        // First we must confirm the interpretation before making a decision on it, 
        // as the invariants state decisions require Confirmed interpretations.
        const confirmRes = await fetch(`/api/interpretation/${interpData.id}/confirm`, {
          method: "POST"
        });
        if (!confirmRes.ok) throw new Error("Failed to confirm interpretation for decision");

        const decRes = await fetch("/api/decision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId,
            interpretationId: interpData.id,
            action: prescription
          })
        });
        if (!decRes.ok) throw new Error("Failed to create prescription decision");
      }

      // Success
      setStep("choose");
      setConclusion("");
      setEvidenceList([{ key: "", value: "" }]);
      setPrescription("");
      setJustification("");
      setFileUrl("");
      onSuccess();
      
    } catch (err: any) {
      setError(err.message || "An error occurred while creating the commit.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] bg-white/95 backdrop-blur-xl border-slate-200 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <GitCommit className="w-5 h-5 text-blue-600" />
            Create New Commit
          </DialogTitle>
          <DialogDescription>
            Record new clinical observations, interpretations, and decisions.
          </DialogDescription>
        </DialogHeader>

        {step === "choose" ? (
          <div className="grid grid-cols-1 gap-4 py-4">
            <button
              onClick={() => { setMode("same"); setStep("form") }}
              className="flex items-start gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
            >
              <div className="bg-blue-100 p-2 rounded-lg mt-1">
                <GitCommit className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Commit to Current Branch</h3>
                <p className="text-sm text-slate-500">Add new evidence or refine the current working hypothesis.</p>
              </div>
            </button>
            
            <button
              onClick={() => { setMode("new"); setStep("form") }}
              className="flex items-start gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left"
            >
              <div className="bg-indigo-100 p-2 rounded-lg mt-1">
                <GitBranch className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Create a New Branch</h3>
                <p className="text-sm text-slate-500">Branch off a previous commit to track an alternative differential diagnosis.</p>
              </div>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-slate-500">Conclusion (Diagnosis)</label>
              <Input required value={conclusion} onChange={e => setConclusion(e.target.value)} placeholder="e.g. Suspected Tuberculosis" className="bg-white" />
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase text-slate-500">Clinical Evidence (Key-Value)</label>
                <Button type="button" variant="ghost" size="sm" onClick={handleAddEvidence} className="h-6 text-xs text-blue-600 hover:text-blue-700">
                  <Plus className="w-3 h-3 mr-1" /> Add Field
                </Button>
              </div>
              
              {evidenceList.map((evidence, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input 
                    value={evidence.key} 
                    onChange={e => handleEvidenceChange(index, "key", e.target.value)} 
                    placeholder="Key (e.g. SpO2)" 
                    className="bg-white w-1/3" 
                  />
                  <Input 
                    value={evidence.value} 
                    onChange={e => handleEvidenceChange(index, "value", e.target.value)} 
                    placeholder="Value (e.g. 98%)" 
                    className="bg-white flex-1" 
                  />
                  {evidenceList.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveEvidence(index)} className="h-9 w-9 text-slate-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-slate-500">Prescription / Action (Optional)</label>
              <Input value={prescription} onChange={e => setPrescription(e.target.value)} placeholder="e.g. Order Sputum AFB Smear" className="bg-white" />
            </div>

            {mode === "new" && (
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-indigo-500">Branch Justification</label>
                <Input required value={justification} onChange={e => setJustification(e.target.value)} placeholder="Why are we investigating this path?" className="bg-white border-indigo-200 focus-visible:ring-indigo-500" />
              </div>
            )}

            <div className="space-y-1 pt-2 border-t">
              <label className="text-xs font-semibold uppercase text-slate-500 block mb-2">Upload Reports (Cloudinary/S3)</label>
              <div className="flex items-center gap-4">
                <Button type="button" variant="outline" className="relative overflow-hidden w-full bg-slate-50 hover:bg-slate-100">
                  <Input type="file" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                  <FileUp className="w-4 h-4 mr-2 text-slate-500" />
                  {uploading ? "Uploading..." : "Select File"}
                </Button>
              </div>
              {fileUrl && <p className="text-xs text-green-600 flex items-center gap-1 mt-1"><ShieldCheck className="w-3 h-3" /> File uploaded securely: {fileUrl.substring(0,30)}...</p>}
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded-md">{error}</p>}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => setStep("choose")} disabled={isSubmitting}>Back</Button>
              <Button type="submit" disabled={isSubmitting} className={mode === "new" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-blue-600 hover:bg-blue-700"}>
                {isSubmitting ? "Committing..." : (mode === "new" ? "Branch & Commit" : "Commit")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
