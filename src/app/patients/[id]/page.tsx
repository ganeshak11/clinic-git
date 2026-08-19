import { Suspense } from "react"
import { notFound } from "next/navigation"
import { PatientGraph } from "./patient-graph"
import { RagPanel } from "./rag-panel"
import { withReadTransaction } from "@/lib/neo4j"
import type { Patient } from "@/lib/types"

async function getPatient(id: string): Promise<Patient | null> {
  const result = await withReadTransaction(async (tx) => {
    const res = await tx.run('MATCH (p:Patient {id: $id}) RETURN p', { id })
    return res.records[0]?.get('p').properties || null
  })
  return result as Patient | null
}

export default async function PatientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = await params
  const patient = await getPatient(resolvedParams.id)
  
  if (!patient) {
    notFound()
  }
  
  return (
    <div className="w-full h-screen flex flex-col bg-slate-50 relative">
      <header className="h-16 bg-white/80 backdrop-blur-md border-b flex items-center justify-between px-6 z-10">
        <div>
          <h1 className="font-semibold text-slate-800 text-lg">
            {patient.name} <span className="font-mono text-sm text-slate-500 ml-2">[{patient.id}]</span>
          </h1>
          <div className="flex gap-4 text-xs text-slate-500 mt-1">
            {patient.age && <span><strong className="text-slate-600">Age:</strong> {patient.age}</span>}
            {patient.gender && <span><strong className="text-slate-600">Gender:</strong> {patient.gender}</span>}
            {patient.weight && <span><strong className="text-slate-600">Weight:</strong> {patient.weight}</span>}
            {patient.height && <span><strong className="text-slate-600">Height:</strong> {patient.height}</span>}
          </div>
        </div>
      </header>
      
      <main className="flex-1 w-full flex overflow-hidden relative">
        <div className="flex-1 relative">
          <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading Clinical Graph...</div>}>
            <PatientGraph patientId={patient.id} />
          </Suspense>
        </div>
        <div className="w-[400px] shrink-0 h-full shadow-lg z-20">
          <RagPanel patientId={patient.id} />
        </div>
      </main>
    </div>
  )
}
