"use client"

import { useState, useCallback, useEffect } from "react"
import { 
  ReactFlow, 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState,
  Node,
  Edge,
  MarkerType
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { CommitNode } from "./commit-node"
import { CommitPanel } from "./commit-panel"
import { CreateCommitDialog } from "./create-commit-dialog"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

const nodeTypes = {
  commit: CommitNode,
}

export function PatientGraph({ patientId }: { patientId: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchGraph = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/patient/${patientId}/log`)
      const data = await res.json()
      
      const initialNodes: Node[] = []
      const initialEdges: Edge[] = []
      
      let lastY = 0
      
      // Root node
      initialNodes.push({
        id: "root",
        type: "commit",
        position: { x: 400, y: lastY },
        data: { 
          id: "root", 
          hash: "init", 
          author: "System", 
          conclusion: "Patient Admitted",
          status: "Confirmed",
          type: "Root" 
        }
      })
      
      if (Array.isArray(data)) {
        const branchCounts: Record<string, number> = {}
        const branchBaseY: Record<string, number> = {}
        const branchParents: Record<string, string> = {}
        const nodePositions: Record<string, { x: number, y: number }> = { root: { x: 400, y: 0 } }
        let prevLinearNode = "root"

        data.forEach((entry: any) => {
          if (entry.type === "branch") {
            const id = entry.nodeId
            branchParents[id] = prevLinearNode
            // We do NOT add Branch to initialNodes or initialEdges 
            // to prevent 3 nodes from spawning on every 'New Branch' commit
          } 
          else if (entry.type === "interpretation") {
            const id = entry.nodeId
            const statusMatch = entry.summary.match(/\[(.*?)\]/)
            const status = statusMatch ? statusMatch[1] : "Active"
            const cleanSummary = entry.summary.replace(/ \[.*?\]$/, '')
            
            let x = 400
            let y = lastY + 150
            let parentId = prevLinearNode

            if (entry.supersedesId) {
              const parentPos = nodePositions[entry.supersedesId]
              if (parentPos) {
                x = parentPos.x
                y = parentPos.y + 150
              }
              parentId = entry.supersedesId
              lastY = Math.max(lastY, y)
              prevLinearNode = id
            } 
            else if (entry.branchId) {
              if (branchCounts[entry.branchId] === undefined) {
                branchCounts[entry.branchId] = 0
                branchBaseY[entry.branchId] = (nodePositions[entry.branchId]?.y || lastY) + 150
              }
              
              const count = branchCounts[entry.branchId] || 0
              branchCounts[entry.branchId] = count + 1
              
              // offset: 0 -> 0, 1 -> -250, 2 -> 250, 3 -> -500, etc.
              const offset = count === 0 ? 0 : (count % 2 === 1 ? -1 : 1) * Math.ceil(count / 2) * 260
              x = (nodePositions[entry.branchId]?.x || 400) + offset
              y = branchBaseY[entry.branchId] || (lastY + 150)
              parentId = branchParents[entry.branchId] || "root"
              
              lastY = Math.max(lastY, y)
            }

            nodePositions[id] = { x, y }

            initialNodes.push({
              id,
              type: "commit",
              position: { x, y },
              data: {
                id,
                hash: id.substring(0, 7),
                author: entry.author || "System",
                conclusion: cleanSummary,
                status,
                type: "Interpretation",
                evidence: entry.evidence,
                nodeData: entry
              }
            })
            
            initialEdges.push({
              id: `e-${parentId}-${id}`,
              source: parentId,
              target: id,
              type: 'smoothstep',
              animated: status === 'Active' || status === 'Hypothesis',
              markerEnd: { type: MarkerType.ArrowClosed, color: status === 'RuledOut' ? '#cbd5e1' : '#94a3b8' },
              style: { 
                stroke: status === 'RuledOut' ? '#cbd5e1' : '#94a3b8', 
                strokeWidth: 2,
                strokeDasharray: status === 'RuledOut' ? '5 5' : 'none'
              }
            })
          }
          else if (entry.type === "decision") {
            const id = entry.nodeId
            const statusMatch = entry.summary.match(/\[(.*?)\]/)
            const status = statusMatch ? statusMatch[1] : "Active"
            const cleanSummary = entry.summary.replace(/ \[.*?\]$/, '')
            
            let x = 400
            let y = lastY + 150
            let parentId = entry.interpretationId || prevLinearNode

            if (entry.interpretationId && nodePositions[entry.interpretationId]) {
              const pos = nodePositions[entry.interpretationId]
              if (pos) {
                x = pos.x
                y = pos.y + 150
              }
            }

            nodePositions[id] = { x, y }
            lastY = Math.max(lastY, y)
            prevLinearNode = id

            initialNodes.push({
              id,
              type: "commit",
              position: { x, y },
              data: {
                id,
                hash: id.substring(0, 7),
                author: entry.author || "System",
                conclusion: cleanSummary,
                status,
                type: "Decision",
                nodeData: entry
              }
            })
            
            initialEdges.push({
              id: `e-${parentId}-${id}`,
              source: parentId,
              target: id,
              type: 'smoothstep',
              animated: status === 'Active',
              markerEnd: { type: MarkerType.ArrowClosed, color: '#2563eb' },
              style: { stroke: '#2563eb', strokeWidth: 3 }
            })
          }
        })
      }

      setNodes(initialNodes)
      setEdges(initialEdges)
    } catch (err) {
      console.error("Failed to load graph", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGraph()
  }, [patientId])

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNodeId(node.id)
  }, [])

  const selectedNode = nodes.find(n => n.id === selectedNodeId)

  return (
    <div className="w-full h-full relative">
      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-50/80 backdrop-blur-sm">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        className="bg-slate-50"
      >
        <Background color="#cbd5e1" gap={16} />
        <Controls className="bg-white shadow-xl border-none rounded-xl overflow-hidden" />
      </ReactFlow>

      <div className="absolute bottom-6 right-6 z-40">
        <Button 
          size="lg"
          onClick={() => setIsCreateOpen(true)}
          className="rounded-full h-16 px-8 shadow-2xl shadow-blue-600/30 bg-blue-600 hover:bg-blue-700 text-lg"
        >
          <Plus className="mr-2 h-6 w-6" /> Create New Commit
        </Button>
      </div>

      {selectedNode && (
        <CommitPanel 
          node={selectedNode} 
          onClose={() => setSelectedNodeId(null)} 
        />
      )}

      <CreateCommitDialog 
        open={isCreateOpen} 
        onOpenChange={setIsCreateOpen} 
        patientId={patientId}
        onSuccess={() => {
          setIsCreateOpen(false)
          fetchGraph()
        }}
      />
    </div>
  )
}
