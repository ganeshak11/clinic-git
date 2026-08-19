import { memo } from "react"
import { Handle, Position, NodeProps } from "@xyflow/react"
import { GitCommit, CheckCircle2, XCircle, AlertCircle } from "lucide-react"

export const CommitNode = memo(({ data, isConnectable }: NodeProps) => {
  const status = data.status as string
  
  let borderColor = "border-slate-300"
  let bgColor = "bg-white"
  let icon = <GitCommit className="w-4 h-4 text-slate-500" />
  
  if (status === "Confirmed" || status === "Active") {
    borderColor = "border-green-500"
    bgColor = "bg-green-50"
    icon = <CheckCircle2 className="w-4 h-4 text-green-600" />
  } else if (status === "RuledOut") {
    borderColor = "border-slate-300"
    bgColor = "bg-slate-100"
    icon = <XCircle className="w-4 h-4 text-slate-500" />
  } else if (status === "Retracted") {
    borderColor = "border-red-500"
    bgColor = "bg-red-50"
    icon = <AlertCircle className="w-4 h-4 text-red-600" />
  } else if (status === "Superseded") {
    borderColor = "border-amber-500"
    bgColor = "bg-amber-50"
    icon = <GitCommit className="w-4 h-4 text-amber-600" />
  } else if (status === "Hypothesis") {
    borderColor = "border-blue-400"
    bgColor = "bg-blue-50"
    icon = <GitCommit className="w-4 h-4 text-blue-500" />
  }

  return (
    <div className={`px-4 py-3 shadow-lg rounded-xl border-2 ${borderColor} ${bgColor} min-w-[200px] transition-all hover:shadow-xl hover:-translate-y-1`}>
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="w-3 h-3 bg-slate-400" />
      
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-mono font-bold text-slate-600 bg-white/50 px-2 py-0.5 rounded border border-slate-200">
          {data.hash as string}
        </span>
        <span className="text-xs text-slate-500 ml-auto font-medium">{data.type as string}</span>
      </div>
      
      <div className="font-semibold text-slate-900 mb-1">{data.conclusion as string}</div>
      <div className="text-xs text-slate-500 flex items-center gap-1">
        <span>By</span>
        <span className="font-medium text-slate-700">{data.author as string}</span>
      </div>

      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="w-3 h-3 bg-slate-400" />
    </div>
  )
})
