import { Badge } from "@/components/ui/badge"
import { STATUS_COLORS } from "@/lib/constants"
import type { InterpretationStatus, DecisionStatus } from "@/lib/types"

interface StatusBadgeProps {
  status: InterpretationStatus | DecisionStatus
  className?: string
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  // Using an exhaustive switch is technically safer, but since STATUS_COLORS is a Record covering
  // the exact union type, TS guarantees we handle all cases.
  const colorClass = STATUS_COLORS[status] || "bg-gray-100 text-gray-800"

  return (
    <Badge 
      variant="outline" 
      className={`${colorClass} font-medium border ${className}`}
    >
      {status}
    </Badge>
  )
}
