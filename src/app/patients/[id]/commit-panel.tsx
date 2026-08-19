import { motion } from "framer-motion"
import { X, GitCommit, User, FileText, Activity, Link as LinkIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Node } from "@xyflow/react"
import { Badge } from "@/components/ui/badge"

export function CommitPanel({ node, onClose }: { node: Node, onClose: () => void }) {
  const data = node.data

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute top-4 right-4 bottom-4 w-96 bg-white/90 backdrop-blur-xl border border-slate-200/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50"
    >
      <div className="p-4 flex items-center justify-between border-b bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <GitCommit className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 leading-none">Commit Details</h3>
            <span className="text-xs font-mono text-slate-500">{data.hash as string}</span>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8 text-slate-400 hover:text-slate-600">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Status / Conclusion */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
            <Activity className="w-3 h-3" /> Conclusion
          </h4>
          <div className="text-lg font-medium text-slate-900 mb-2">
            {data.conclusion as string}
          </div>
          <Badge variant="outline" className="bg-slate-50">{data.status as string}</Badge>
        </div>

        <Separator />

        {/* Author */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
            <User className="w-3 h-3" /> Author
          </h4>
          <p className="text-sm text-slate-700">{data.author as string}</p>
        </div>

        <Separator />

        {/* Evidence */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
            <FileText className="w-3 h-3" /> Evidence
          </h4>
          {Array.isArray(data.evidence) && data.evidence.length > 0 ? (
            <ul className="space-y-2">
              {(data.evidence as any[]).map((ev, i) => (
                <li key={i} className="text-sm bg-slate-50 p-2 rounded-lg border border-slate-100 text-slate-600 flex flex-col gap-1">
                  <div className="flex items-center">
                    <span className="font-mono text-xs text-slate-400 mr-2">[{ev.id.substring(0,6)}]</span>
                    <span>{ev.value}</span>
                  </div>
                  {ev.url && (
                    <a href={ev.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 ml-10">
                      <LinkIcon className="w-3 h-3" /> View Attachment
                    </a>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400 italic">No direct evidence attached.</p>
          )}
        </div>

        <Separator />

        {/* Links section removed as it is now integrated into Evidence */}
      </div>
    </motion.div>
  )
}
